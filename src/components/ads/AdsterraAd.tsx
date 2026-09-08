import { useEffect, useRef } from 'react'

const ADSTERRA_CONTAINER_ID = 'container-3c38ac0440cda8d6dc5e05eb5625645d'
const ADSTERRA_SCRIPT_SRC = 'https://pl30782583.effectivecpmnetwork.com/3c38ac0440cda8d6dc5e05eb5625645d/invoke.js'

export function AdsterraAd() {
  const slotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const slot = slotRef.current
    const container = slot?.querySelector<HTMLElement>(`#${ADSTERRA_CONTAINER_ID}`)

    if (!slot || !container) return

    container.replaceChildren()

    const script = document.createElement('script')
    script.async = true
    script.dataset.cfasync = 'false'
    script.dataset.coperoAdsterra = 'true'
    script.src = ADSTERRA_SCRIPT_SRC
    slot.appendChild(script)

    return () => {
      script.remove()
      container.replaceChildren()
    }
  }, [])

  return (
    <aside className="adsterra-ad" aria-label="Advertisement">
      <span className="adsterra-ad__label" aria-hidden="true">Advertisement</span>
      <div className="adsterra-ad__slot" ref={slotRef}>
        <div className="adsterra-ad__container" id={ADSTERRA_CONTAINER_ID} />
      </div>
    </aside>
  )
}
