import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackDTO } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const t = await db.track.findUnique({ where: { id } })
  if (!t) return NextResponse.json({ error: 'Track not found' }, { status: 404 })
  return NextResponse.json({ track: trackDTO(t) })
}
