import { render, html } from './async'
import { Omni } from './Omni.js'
import context from './helpers/context.js'

(async () => {
  const omni = await new Omni('https://ruben.verborgh.org/profile/', { context })
  const person = omni.get('https://ruben.verborgh.org/profile/#me')

  // Simulate network cut off.
  // omni.simulateOffline = true

  const draw = async () => {
    render(document.body, html`
    <h1>${person.name}</h1>
    <ul>
      ${person.friends.givenName.map(name => html`
        <li>${name}</li>
      `)}
    </ul>
  `);
  }

  window.addEventListener('draw', draw)
  draw()
})()