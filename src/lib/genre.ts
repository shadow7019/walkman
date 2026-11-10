// Canonical genre taxonomy + mapping from arbitrary source genre labels
export const GENRES = [
  'Pop', 'Hip-Hop', 'Rock', 'Electronic', 'R&B', 'Jazz',
  'Classical', 'Country', 'Metal', 'Indie', 'Latin', 'Folk',
  'Ambient', 'Reggae', 'Blues', 'Funk', 'Soul', 'Techno',
  'House', 'Dubstep', 'Lo-Fi', 'K-Pop', 'Afrobeats', 'Soundtrack',
  'Bollywood', 'Anime',
] as const

export type Genre = (typeof GENRES)[number]

export const GENRE_COLORS: Record<string, string> = {
  Pop: 'from-pink-500 to-rose-600',
  'Hip-Hop': 'from-orange-500 to-amber-700',
  Rock: 'from-red-500 to-red-800',
  Electronic: 'from-cyan-500 to-teal-700',
  'R&B': 'from-purple-500 to-purple-800',
  Jazz: 'from-amber-400 to-yellow-700',
  Classical: 'from-stone-400 to-stone-700',
  Country: 'from-yellow-500 to-orange-700',
  Metal: 'from-zinc-500 to-zinc-900',
  Indie: 'from-emerald-500 to-green-700',
  Latin: 'from-orange-400 to-red-600',
  Folk: 'from-lime-500 to-green-800',
  Ambient: 'from-sky-400 to-cyan-700',
  Reggae: 'from-green-500 to-yellow-600',
  Blues: 'from-blue-400 to-indigo-800',
  Funk: 'from-fuchsia-500 to-purple-700',
  Soul: 'from-rose-400 to-red-700',
  Techno: 'from-slate-500 to-slate-800',
  House: 'from-violet-500 to-indigo-700',
  Dubstep: 'from-lime-400 to-emerald-800',
  'Lo-Fi': 'from-teal-400 to-cyan-800',
  'K-Pop': 'from-pink-400 to-fuchsia-600',
  Afrobeats: 'from-amber-500 to-orange-800',
  Soundtrack: 'from-indigo-400 to-slate-700',
  Bollywood: 'from-orange-400 to-pink-600',
  Anime: 'from-rose-400 to-purple-600',
}

// Map arbitrary genre strings from any source to canonical genre
export function canonicalGenre(raw: string): string {
  const g = (raw || '').toLowerCase().trim()
  if (!g) return 'Pop'
  const rules: [RegExp, string][] = [
    [/bollywood|filmi|indian.?pop|desi/, 'Bollywood'],
    [/anime|vocaloid/, 'Anime'],
    [/hip.?hop|rap|trap|drill|grime|gangsta/, 'Hip-Hop'],
    [/dubstep|bass|140/, 'Dubstep'],
    [/techno|trance|acid/, 'Techno'],
    [/house|deep.?house|tech.?house|disco|electro|edm|dance|drum.?and.?bass|jungle|breakbeat|footwork|uk garage|garage/, 'House'],
    [/electronic|electronica|idm|ambient.?house|synthwave|retrowave|vaporwave|chillwave|downtempo/, 'Electronic'],
    [/lo.?fi|lofi|chill(hop|out)?|study/, 'Lo-Fi'],
    [/metal|metalcore|death|doom|grind|hardcore/, 'Metal'],
    [/rock|punk|grunge|alternative|indie.?rock|garage.?rock|psychedelic|emo|shoegaze/, 'Rock'],
    [/indie|singer.?songwriter|chamber/, 'Indie'],
    [/r&b|rnb|contemporary r|urban/, 'R&B'],
    [/soul|motown|gospel/, 'Soul'],
    [/funk|boogie/, 'Funk'],
    [/jazz|swing|bebop|bossa|fusion|lounge/, 'Jazz'],
    [/blues/, 'Blues'],
    [/classical|orchestra|symphon|piano|chamber|opera|baroque|sonata|concerto|neoclassic/, 'Classical'],
    [/country|bluegrass|americana|honky/, 'Country'],
    [/folk|acoustic|singer|celtic|world|traditional/, 'Folk'],
    [/ambient|drone|soundscape|meditat|healing|sleep|nature/, 'Ambient'],
    [/reggae|dancehall|ska|ragga/, 'Reggae'],
    [/latin|reggaeton|salsa|cumbia|bachata|samba|tango|latin.?pop|corrido|banda|merengue/, 'Latin'],
    [/k.?pop|kpop/, 'K-Pop'],
    [/afro|amapiano|highlife|juju/, 'Afrobeats'],
    [/soundtrack|score|film|movie| OST|walt disney|broadway|musical/, 'Soundtrack'],
    [/pop|ballad|eurodance|new.?wave|dream/, 'Pop'],
  ]
  for (const [re, canon] of rules) if (re.test(g)) return canon
  return 'Pop'
}

// Map Audius mood to our mood buckets
export function canonicalMood(raw: string): string {
  const m = (raw || '').toLowerCase()
  if (/peace|calm|chill|easy|sentimental|romantic|tender|mellow|dreamy/.test(m)) return 'Chill'
  if (/energ|excit|power|aggress|epic|angry|intense|driving|brooding/.test(m)) return 'Energetic'
  if (/happy|joy|upbeat|optimis|playful|fun/.test(m)) return 'Happy'
  if (/sad|melanchol|gloom|dark|moody|somber|emotional/.test(m)) return 'Melancholy'
  if (/focus|stud|sleep|relax|meditat|peaceful/.test(m)) return 'Focus'
  return raw || ''
}
