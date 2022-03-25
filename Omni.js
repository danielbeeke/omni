import ldflexComunica from "@ldflex/comunica";
const { default: ComunicaEngine } = ldflexComunica
import { PathFactory } from 'ldflex'
import dataModel from '@rdfjs/data-model'
const { namedNode } = dataModel
import { hash } from "./helpers/hash.js";
import { ArrayIterator } from 'asynciterator'
import immutable from 'immutable'

// Isomorphic trickery.
if (!globalThis.indexedDB) await import('fake-indexeddb/auto.js')
if (!globalThis.navigator) globalThis.navigator = { onLine: true }

/**
 * Easy offline storage with LDflex, how does it work?
 * 
 * Query results are intercepted and stored in IndexedDB.
 * 
 */
export class Omni extends ComunicaEngine {

  constructor (defaultSource, settings) {
    super(defaultSource, settings)
    this.__context = settings.context

    this.stores = {
      queries: null,
      triples: null
    }

    const originalQuery = this._engine.query

    /**
     * Grabs results from queries and saves them in IndexedDB.
     * When the navigator is offLine this returns results from previous requests.
     * 
     * I am not sure why a clone on the bindingstream does not result in a copy.
     */
    this._engine.query = async (query, source) => {
      const queryHash = hash(JSON.stringify(source) + query)

      if (queryHash && !navigator.onLine) {
        const queryObject = await this.transaction('queries', [{ command: 'get', data: queryHash }])
        const bindingsMap = JSON.parse(queryObject?.bindings ?? '[]').map(immutable.Map)
        const bindingsStream = new ArrayIterator(bindingsMap, { autoStart: false })

        return {
          type: 'bindings',
          bindingsStream,
          variables: queryObject?.variables
        }
      }

      const results = await originalQuery.apply(this._engine, [query, source])

      return new Promise((resolve) => {
        const bindings = []
        results.bindingsStream.on('data', (binding) => {
          bindings.push(binding)
        })

        results.bindingsStream.on('end', async () => {
          resolve(this.returnBindingsAsResult(bindings, results.variables))

          const queryObject = { 
            id: queryHash, 
            query, 
            bindings: JSON.stringify(bindings), 
            variables: results.variables 
          }
  
          await this.transaction('queries', [
            { command: 'delete', data: queryObject.id },
            { command: 'add', data: queryObject }
          ], 'readwrite')
        })
      })
    }

    return new Promise(async (resolve) => {
      await this.initDatabase()
      resolve(this)
    })
  }

  async returnBindingsAsResult (bindings, variables) {
    const bindingsMap = (typeof bindings === 'string' ? JSON.parse(bindings ?? '[]') : bindings).map(immutable.Map)
    const bindingsStream = new ArrayIterator(bindingsMap, { autoStart: false })
    return {
      type: 'bindings',
      bindingsStream,
      variables: variables
    }
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
    if (!this.paths) this.paths = new PathFactory({ context: this.__context, queryEngine: this });
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