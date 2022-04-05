import { render, html } from './helpers/async.js'
import { Omni } from './Omni.js'
import context from './helpers/context.js'


(async () => {
  const omni = await new Omni({ value: 'https://jena.mep/contents', type: 'sparql' }, { context })
  const ebooks = omni.getAll('content:Ebook')

  const getFirstItem = `rdf:rest*/rdf:first`
  // Simulate network cut off.
  // omni.simulateOffline = true

  const draw = async () => {
    render(document.body, html`
      <ul class="ebooks">${ebooks.unfold(ebook => html`
        <li class="ebook">
          <h3 class="ebook-title">${ebook['schema:name']}</h3>

          <h4>Keywords</h4>
          <ul class="keywords">${ebook['schema:keywords'].unfold(keyword => html`
            <li>${keyword['schema:name']}</li>`)}
          </ul>

          <h4>Authors</h4>
          <ul class="authors">${ebook['schema:author'].unfold(author => html`
            <li>
              ${author['schema:name']}
            </li>`)}
          </ul>
        </li>`)}
      </ul>
  `);
  }

  window.addEventListener('draw', draw)
  draw()

  // await ebooks.preload('schema:name', 'schema:genre/schema:name')
  // for await (const ebook of ebooks) {
  //   console.log(await ebook['schema:name'] + '')
  //   // console.log(await ebook['schema:genre/schema:name'] + '')
  //   for await (const genre of ebook['schema:genre/schema:name']) {
  //     console.log('-- ' + await genre + '')
  //   }
  // }
})()