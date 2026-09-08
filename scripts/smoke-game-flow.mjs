import { createServer } from 'vite'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const server = await createServer({
  root: process.cwd(),
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const [stateModule, game, draft, origin, catalog, types] = await Promise.all([
    server.ssrLoadModule('/src/engine/state.ts'),
    server.ssrLoadModule('/src/engine/game.ts'),
    server.ssrLoadModule('/src/engine/draft.ts'),
    server.ssrLoadModule('/src/engine/originStart.ts'),
    server.ssrLoadModule('/src/data/catalog.ts'),
    server.ssrLoadModule('/src/engine/types.ts'),
  ])

  let state = stateModule.createInitialState('express', 'classic')
  assert(state.phase === 'intro', 'A new game must start on the intro phase.')

  const expressState = stateModule.createInitialState('express', 'purist')
  assert(expressState.mode === 'express', 'Quick career entry must create an express-mode state.')
  assert(types.MODE_CONFIG.long.periodLengthSeasons === 1, 'Full career must advance one season per chapter.')
  assert(types.MODE_CONFIG.express.periodLengthSeasons === 3, 'Quick career must advance three seasons per chapter.')
  assert(types.MODE_CONFIG.long.personalEventChance > types.MODE_CONFIG.express.personalEventChance, 'Full career must keep a higher personal-event frequency than quick career.')
  const expressIdentity = stateModule.startIdentity(expressState)
  assert(expressIdentity.mode === 'express', 'Entering identity creation must preserve quick career mode.')
  assert(expressIdentity.draftMode === 'purist', 'Career pacing must remain independent from draft mode.')

  state = game.beginCareer(state)
  assert(state.phase === 'identity', 'Starting the game must open identity creation.')

  const country = catalog.allCountries.find(
    (candidate) => catalog.academyTeamsForCountry(candidate.fifa_code).length >= 3,
  )
  assert(country, 'The catalog must contain a country with origin club options.')

  let homepageState = stateModule.createInitialState('express', 'purist')
  homepageState = game.confirmIdentity(homepageState, {
    lastName: 'Homepage',
    preferredNumber: 9,
    preferredFoot: 'left',
    position: 'ST',
    nationalityFifa: country.fifa_code,
    heritageNationalityFifa: null,
  })
  homepageState = draft.initializeDraft(homepageState)
  assert(homepageState.phase === 'draft', 'Homepage identity submission must bypass intro and enter the draft.')
  assert(homepageState.mode === 'express', 'Mode landing entry must preserve express pacing through the draft.')
  assert(homepageState.draftMode === 'purist', 'Homepage entry must preserve the selected draft mode.')
  assert(homepageState.draft.currentLegendId, 'Homepage entry must initialize the first draft legend before navigation.')
  assert(homepageState.player?.preferredNumber === 9, 'Homepage identity data must reach the shared game state.')

  state = game.confirmIdentity(state, {
    lastName: 'Smoke',
    preferredNumber: 10,
    preferredFoot: 'right',
    position: 'ST',
    nationalityFifa: country.fifa_code,
    heritageNationalityFifa: null,
  })
  state = draft.initializeDraft(state)

  assert(state.phase === 'draft', 'Confirming identity must enter the legend draft.')
  assert(state.draft.currentLegendId, 'The first draft legend must be available immediately.')

  for (let round = 1; round <= draft.ATTRIBUTE_ORDER.length; round += 1) {
    state = draft.acceptRecommendedDraftAttribute(state)
    if (round < draft.ATTRIBUTE_ORDER.length) {
      assert(state.phase === 'draft', `Draft round ${round} must advance to another draft round.`)
      assert(state.draft.currentLegendId, `Draft round ${round + 1} must have a legend.`)
      assert(state.draft.picks.length === round, `Draft round ${round} must record one attribute.`)
    }
  }

  assert(state.phase === 'draft_result', 'Eight draft choices must open the drafted player result.')
  assert(state.draft.completed, 'The draft must be marked as completed.')
  assert(state.draft.picks.length === draft.ATTRIBUTE_ORDER.length, 'All eight attributes must be drafted.')

  state = draft.continueFromDraftResult(state)
  assert(state.phase === 'origin', 'Continuing from the draft result must open origin selection.')

  const originChoices = origin.originClubChoices(state)
  assert(originChoices.length === 3, 'Origin selection must provide exactly three clubs.')
  assert(new Set(originChoices.map((team) => team.id)).size === 3, 'Origin clubs must be unique.')

  state = game.confirmOriginClub(state, originChoices[0].id)
  assert(state.phase === 'career', 'Confirming an origin club must start the career.')
  assert(state.currentTeamId === originChoices[0].id, 'The selected origin club must become the current club.')

  let reachedSeason = state.seasons.length > 0
  let finishedCareer = state.phase === 'summary'

  for (let interaction = 0; interaction < 500 && !finishedCareer; interaction += 1) {
    reachedSeason ||= state.seasons.length > 0

    if (state.phase === 'summary') {
      finishedCareer = true
      break
    }

    if (state.celebration && !state.currentEvent) {
      state = game.dismissCelebration(state)
      continue
    }

    const event = state.currentEvent
    if (!event) {
      state = game.afterSeasonContinue(state)
      continue
    }

    switch (event.type) {
      case 'trait_pick': {
        const firstTrait = event.options[0]?.id
        assert(firstTrait, 'Trait selection must provide at least one option.')
        state = game.chooseTraits(state, [firstTrait])
        break
      }
      case 'youth_loan_choice':
        state = game.respondYouthLoanChoice(state, false)
        break
      case 'objective_briefing':
        state = game.dismissObjectiveBriefing(state)
        break
      case 'season_result':
        state = game.afterSeasonContinue(state)
        break
      case 'offer': {
        const firstOffer = event.offers[0]
        assert(firstOffer, 'An offer event must contain at least one offer.')
        state = game.acceptOffer(state, firstOffer.id)
        break
      }
      case 'career_choice': {
        const firstChoice = event.choices[0]
        assert(firstChoice, 'A career event must contain at least one choice.')
        const preview = game.previewCareerChoice(state, firstChoice.id)
        state = game.commitCareerChoiceResult(preview.resolved)
        break
      }
      case 'national_callup':
        state = game.respondNationalCallup(state, false)
        break
      case 'retire':
        state = game.goToSummary(state)
        break
      case 'negotiation':
        throw new Error('The automatic smoke path should never enter negotiation directly.')
      default:
        throw new Error(`Unhandled career event: ${event.type}`)
    }

    finishedCareer = state.phase === 'summary'
  }

  assert(reachedSeason, 'The career flow must successfully simulate at least one season.')
  assert(finishedCareer, 'The automatic career flow must eventually reach the summary screen.')
  assert(state.seasons.length > 0, 'The completed career must contain season records.')
  assert(state.mode === 'express', 'A complete quick-career flow must preserve express mode through retirement.')

  console.log(
    `Game flow smoke test passed: homepage entry + ${state.seasons.length} seasons, ${state.draft.picks.length} draft picks.`,
  )
} finally {
  await server.close()
}
