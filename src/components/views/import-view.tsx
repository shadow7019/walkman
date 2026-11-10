'use client'

// Import: bring playlists from any app — public Spotify links, text lists, CSV exports.
import { useRef, useState } from 'react'
import { Link2, FileText, Table2, Loader2, CheckCircle2, XCircle, ListMusic } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { useLibrary } from '@/stores/library'
import { api } from '@/lib/client-api'
import type { ImportResult } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ImportView() {
  const { navigate, toast } = useUI()
  const { refreshPlaylists } = useLibrary()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [text, setText] = useState('')
  const [order, setOrder] = useState<'artist-first' | 'title-first'>('artist-first')
  const [csv, setCsv] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (fn: () => Promise<ImportResult>, label: string) => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const r = await fn()
      setResult(r)
      await refreshPlaylists()
      toast(`${label}: ${r.matched}/${r.total} matched`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import playlists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring playlists from any app — no sign-in needed. Every matched song is found on the Walkman catalog
          (full-length when available), and the rest of your list is reported honestly.
        </p>
      </div>

      <Tabs defaultValue="spotify">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="spotify" className="gap-1.5"><Link2 className="h-3.5 w-3.5" aria-hidden /> Spotify link</TabsTrigger>
          <TabsTrigger value="text" className="gap-1.5"><FileText className="h-3.5 w-3.5" aria-hidden /> Text list</TabsTrigger>
          <TabsTrigger value="csv" className="gap-1.5"><Table2 className="h-3.5 w-3.5" aria-hidden /> CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="spotify" className="space-y-3 rounded-xl border border-border/50 bg-black/30 p-5">
          <Label htmlFor="sp-url">Public Spotify playlist URL</Label>
          <Input
            id="sp-url"
            placeholder="https://open.spotify.com/playlist/…"
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Paste any public playlist link (Share → Copy link). Works without a Spotify account; private playlists aren't readable.
          </p>
          <Button
            disabled={busy || !spotifyUrl.trim()}
            onClick={() => run(() => api.importSpotify(spotifyUrl.trim()), 'Spotify import')}
            className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
            {busy ? 'Matching songs…' : 'Import playlist'}
          </Button>
        </TabsContent>

        <TabsContent value="text" className="space-y-3 rounded-xl border border-border/50 bg-black/30 p-5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="txt">Songs, one per line</Label>
            <Select value={order} onValueChange={(v) => setOrder(v as 'artist-first' | 'title-first')}>
              <SelectTrigger className="w-44" aria-label="Line format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="artist-first">Artist - Title</SelectItem>
                <SelectItem value="title-first">Title - Artist</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            id="txt"
            rows={8}
            placeholder={'The Weeknd - Blinding Lights\nDua Lipa - Levitating\nQueen - Bohemian Rhapsody'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Works with lists from Apple Music, YouTube Music, or anywhere — even chat messages.
          </p>
          <Button
            disabled={busy || !text.trim()}
            onClick={() => run(() => api.importText(text, order), 'Text import')}
            className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
            {busy ? 'Matching songs…' : 'Import list'}
          </Button>
        </TabsContent>

        <TabsContent value="csv" className="space-y-3 rounded-xl border border-border/50 bg-black/30 p-5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="csv">CSV export</Label>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose file…</Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setCsv(await f.text())
              }}
              aria-label="Choose CSV file"
            />
          </div>
          <Textarea
            id="csv"
            rows={8}
            placeholder={'"Track Name","Artist Name(s)"\n"Blinding Lights","The Weeknd"'}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Compatible with Exportify and TuneMyMusic CSV exports.
          </p>
          <Button
            disabled={busy || !csv.trim()}
            onClick={() => run(() => api.importCSV(csv), 'CSV import')}
            className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
            {busy ? 'Matching songs…' : 'Import CSV'}
          </Button>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300" role="alert">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Import failed</p>
            <p className="mt-0.5 text-xs text-red-200/80">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border/50 bg-black/30 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-[#1ed760]" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold">{result.name}</p>
              <p className="text-xs text-muted-foreground">
                {result.matched} of {result.total} songs matched{result.skippedOverflow ? ` · first ${result.total} of a longer list` : ''}
              </p>
            </div>
            <Button
              size="sm"
              className="gap-2 bg-[#1db954] text-black hover:bg-[#1ed760]"
              onClick={() => navigate({ name: 'playlist', id: result.playlistId })}
            >
              <ListMusic className="h-4 w-4" aria-hidden /> Open playlist
            </Button>
          </div>
          {result.notFound.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Not found ({result.notFound.length})
              </p>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border/40 p-3">
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {result.notFound.map((n, i) => <li key={i}>· {n}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
