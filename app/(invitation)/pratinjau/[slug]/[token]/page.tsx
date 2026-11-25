import { GuestInvitation } from '@/features/invitation/GuestInvitation'

export default async function PreviewInvitation({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  return <GuestInvitation key={`${slug}/${token}`} token={token} preview />
}
