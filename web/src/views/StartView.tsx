import { CSSProperties } from 'react'
import { Ghost } from '../components/Ghost'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function StartView() {
  return (
    <main className="start">
      <div className="enter" style={delay(0)}>
        <div className="start-ghost" aria-hidden="true">
          <Ghost tone="quantum" />
        </div>
      </div>
      <h1 className="enter" style={delay(140)}>
        Ghost Walk
      </h1>
      <p className="start-lede enter" style={delay(300)}>
        A quantum ghost is spread over sixteen rooms at once. Catch it before your four flashlights run out.
      </p>
      <div className="actions enter" style={delay(440)}>
        <a className="btn-plain" href="#/play">
          Play
        </a>
        <a className="btn-plain" href="#/docs">
          Read the docs
        </a>
      </div>
      <p className="start-foot enter" style={delay(600)}>
        Built on a Qiskit quantum walk. Also ran on ibm_kingston, a real IBM quantum computer.
      </p>
    </main>
  )
}
