/**
 * @jest-environment jsdom
 */

import { getChain } from "../src/helpers/getChain.js";
import { render, html } from '../src/helpers/async.js'

const callback = ebook => {

  return html`
    <li>
      <h2 class="ebook-title">${ebook['schema:name']}</h2>
      
      ${ebook['schema:genre'].unfold(genre => html`
        <h3 class="genre-title">
          ${genre['schema:name']}
          <span class="score">${genre['schema:score/schema:points']}</span>
        </h3>
      `)}

      ${ebook['schema:author'].unfold(author => html`
        <h3 class="author-title">
          ${author['schema:name']}
          ${author['schema:url'].unfold(url => html`<a href=${url}>${url}</a>`)}
        </h3>
      `)}

    </li>
  `

}

test('getChain, it gets all used predicates from the recursive callbacks', () => {
  expect(getChain(callback)).toEqual([
    'schema:name',
    'schema:genre',
    'schema:genre/schema:name',
    'schema:genre/schema:score/schema:points',
    'schema:author',
    'schema:author/schema:name',
    'schema:author/schema:url',
  ]);
});