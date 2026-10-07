import { useEffect, useRef, useState } from 'react'
import anime from 'animejs/lib/anime.es.js'

// Rolls smoothly from the previous number to the new one.
// Pure presentation: it only animates a value you already have.
export default function AnimatedNumber({ value, duration = 400 }) {
  const [display, setDisplay] = useState(value)
  const current = useRef(value)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = value
      setDisplay(value)
      return
    }
    const state = { v: current.current }
    const anim = anime({
      targets: state,
      v: value,
      duration,
      easing: 'easeOutCubic',
      round: 1,
      update: () => {
        current.current = state.v
        setDisplay(state.v)
      },
    })
    return () => anim.pause()
  }, [value, duration])

  return <>{display}</>
}
