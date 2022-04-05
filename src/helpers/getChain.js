import { onlyUnique } from "./onlyUnique.js"

const blackList = ['then', 'proxy', 'map', 'unfold', 'length', Symbol.toPrimitive]

const pathTesterProxy = (chain = [], parent) => {
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'proxy') return true
      if (['toString', Symbol.toPrimitive].includes(prop)) return () => ''
      if (prop === 'unfold') {
        return (callback) => {
          const subChain = getChain(callback)
  
          for (const subChainItem of subChain) {
            chain.push(parent + '/' + subChainItem)
          }

          return pathTesterProxy(chain, parent)
        }
      }

      if (!blackList.includes(prop)) chain.push(prop)

      return pathTesterProxy(chain, prop)
    },
  })
}

export const getChain = (callback, chain = []) => {
  try {
    callback(pathTesterProxy(chain)).catch(console.log)
  } catch (exception) { console.log(exception) }
  return chain.filter(onlyUnique)
}