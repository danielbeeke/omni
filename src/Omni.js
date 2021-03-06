import ComunicaEngine from "@ldflex/comunica";
import { PathFactory, defaultHandlers } from 'ldflex'
import dataModel from '@rdfjs/data-model'
const { namedNode } = dataModel
import { hash } from "./helpers/hash.js";
import { ArrayIterator } from 'asynciterator'
import immutable from 'immutable'
import { Bindings } from '@comunica/bindings-factory' ;
import { DataFactory } from 'rdf-data-factory';
import defaultIterationHandlers from '@ldflex/async-iteration-handlers'
import { progressively } from "./helpers/progressively.js";

// Isomorphic trickery.
// if (!globalThis.indexedDB) await import('fake-indexeddb/auto.js')
// if (!globalThis.navigator) globalThis.navigator = { onLine: true }

/**
 * Easy offline storage with LDflex, how does it work?
 * 
 * Query results are intercepted and stored in IndexedDB.
 * 
 */
export class Omni extends ComunicaEngine {

  constructor (defaultSource, settings) {
    super(defaultSource, settings)
    this.context = settings.context
    this.simulateOffline = false

    delete settings.context

    this.stores = {
      queries: null,
      triples: null
    }

    this.dataFactory = new DataFactory()

    const originalQuery = this.engine.queryBindings

    /**
     * Grabs results from queries and saves them in IndexedDB.
     * When the navigator is offLine this returns results from previous requests.
     */
    this.engine.queryBindings1 = async (query, source) => {
      const queryHash = hash(JSON.stringify(source) + query)

      if (queryHash && (!navigator.onLine || this.simulateOffline)) {
        const queryObject = await this.transaction('queries', [{ command: 'get', data: queryHash }])
        if (!queryObject) return null

        const items = JSON.parse(queryObject.entries)
        return this.output(items)
      }

      const results = await originalQuery.apply(this.engine, [query, source])
      const clonedResults = results.clone()
      const streamedResults = []

      results.on('data', (result) => streamedResults.push(result))

      results.on('end', () => {
        const queryObject = { id: queryHash, query, entries: JSON.stringify(streamedResults) }

        this.transaction('queries', [
          { command: 'delete', data: queryObject.id },
          { command: 'add', data: queryObject }
        ], 'readwrite')
      })

      return clonedResults
    }

    return new Promise(async (resolve) => {
      await this.initDatabase()
      resolve(this)
    })
  }

  output (items) {
    const bindings = items.map(item => new Bindings(this.dataFactory, immutable.Map(item.entries)))
    return new ArrayIterator(bindings, { autoStart: false })
  }

  /**
   * Creates the indexedDB stores and does upgrades.
   */
  async initDatabase () {
    return new Promise(async (resolve, reject) => {
      let openRequest = indexedDB.open('dataDB', 1)

      openRequest.addEventListener('error', (error) => reject(error), { once: true })

      openRequest.addEventListener('success', async (event) => {
        this.database = event.target.result
        resolve(true)
      }, { once: true })

      openRequest.addEventListener('upgradeneeded', async (event) => {
        this.database = event.target.result

        const oldVersion = event.oldVersion
        const newVersion = event.newVersion || this.database.version

        for (const storeName of Object.keys(this.stores)) {
          if (!this.database.objectStoreNames.contains(storeName)) {
            this.database.createObjectStore(storeName, { keyPath: 'id' })  
          }
        }
      }, { once: true })
    })
  }

  /**
   * Returns a new LDflex path.
   * @param {*} uri 
   * @returns 
   */
  get (uri) {
    const handlers = {
      ...defaultHandlers,
      map: progressively
    }

    if (!this.paths) this.paths = new PathFactory({ context: this.context, handlers, queryEngine: this });

    return this.paths.create({ subject: namedNode(uri) })
  }
  
  /**
   * A wrapper for indexedDB transactions.
   * @param {*} storeName 
   * @param {*} requests 
   * @param {*} mode 
   * @returns 
   */
  transaction (storeName, requests, mode = 'readonly') {
    if (!(storeName in this.stores)) return
    const transaction = this.database.transaction(storeName, mode)
    const results = []

    for (const request of requests) {
      const store = transaction.objectStore(storeName)
      const requestObject = store[request.command](request.data)
      requestObject.addEventListener('success', (event) => {
        if (event.target?.result) results.push(event.target.result)
      }, { once: true })
    }

    return new Promise((resolve, reject) => {
      transaction.addEventListener('complete', (event) => requests.length === 1 && requests[0].command === 'get' ? resolve(results.pop()) : resolve(results), { once: true })
      transaction.addEventListener('error', (error) => console.warn(error), { once: true })
    })
  }
}