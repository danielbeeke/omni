import { Omni } from './Omni.js'

const context = {
  "@context": {
    "@vocab": "http://xmlns.com/foaf/0.1/",
    "friends": "knows",
  }
}

const omni = await new Omni('https://ruben.verborgh.org/profile/', { context })





// Somewhere in your app. ----------------------

const showPersonInfo = async (uri) => {
  const person = omni.get(uri)
  let friends = 0
  console.log(`This person is ${await person.name}`)

  for await (const name of person.friends.givenName)
    friends++

  console.log(friends)
}

await showPersonInfo('https://ruben.verborgh.org/profile/#me')

// Simulate network cut off.
globalThis.navigator.onLine = false

setTimeout(async () => {
  await showPersonInfo('https://ruben.verborgh.org/profile/#me')
})