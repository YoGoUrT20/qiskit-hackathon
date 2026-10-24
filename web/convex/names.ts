const ADJECTIVES = [
  'Pale', 'Brave', 'Quiet', 'Lucky', 'Misty', 'Swift', 'Sly', 'Bold', 'Calm', 'Eerie',
  'Sleepy', 'Wise', 'Jolly', 'Hollow', 'Shady', 'Spooky', 'Cosmic', 'Gentle', 'Rusty', 'Velvet',
  'Silver', 'Amber', 'Crimson', 'Midnight', 'Foggy', 'Wandering', 'Curious', 'Nimble', 'Merry', 'Frosty',
]

const NOUNS = [
  'Lantern', 'Owl', 'Raven', 'Candle', 'Moth', 'Bat', 'Fox', 'Cat', 'Spider', 'Pumpkin',
  'Torch', 'Wisp', 'Hound', 'Toad', 'Crow', 'Badger', 'Hunter', 'Seeker', 'Keeper', 'Lamp',
  'Qubit', 'Photon', 'Wave', 'Comet', 'Shadow', 'Echo', 'Spark', 'Beetle', 'Weasel', 'Goblin',
]

const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]

export const randomName = () => `${pick(ADJECTIVES)} ${pick(NOUNS)}`
