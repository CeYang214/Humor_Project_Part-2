'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireSuperadmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function getMessagePath(status: 'success' | 'error', message: string) {
  return `/admin/images?status=${status}&message=${encodeURIComponent(message)}`
}

function normalizeUrl(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeId(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export async function signOutAdminAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function createImageAction(formData: FormData) {
  const { supabase, user } = await requireSuperadmin()
  const url = normalizeUrl(formData.get('url'))

  if (!url) {
    redirect(getMessagePath('error', 'Image URL is required.'))
  }

  let validatedUrl: URL
  try {
    validatedUrl = new URL(url)
  } catch {
    redirect(getMessagePath('error', 'Please provide a valid absolute URL.'))
  }

  const { error } = await supabase
    .from('images')
    .insert({
      url: validatedUrl.toString(),
      profile_id: user.id,
    })

  if (error) {
    redirect(getMessagePath('error', `Create failed: ${error.message}`))
  }

  revalidatePath('/admin')
  revalidatePath('/admin/images')
  redirect(getMessagePath('success', 'Image created.'))
}

export async function updateImageAction(formData: FormData) {
  const { supabase } = await requireSuperadmin()
  const id = normalizeId(formData.get('id'))
  const url = normalizeUrl(formData.get('url'))

  if (!id || !url) {
    redirect(getMessagePath('error', 'Image ID and URL are required for update.'))
  }

  let validatedUrl: URL
  try {
    validatedUrl = new URL(url)
  } catch {
    redirect(getMessagePath('error', 'Please provide a valid absolute URL.'))
  }

  const { error } = await supabase
    .from('images')
    .update({ url: validatedUrl.toString() })
    .eq('id', id)

  if (error) {
    redirect(getMessagePath('error', `Update failed: ${error.message}`))
  }

  revalidatePath('/admin')
  revalidatePath('/admin/images')
  redirect(getMessagePath('success', `Image ${id.slice(0, 8)} updated.`))
}

export async function deleteImageAction(formData: FormData) {
  const { supabase } = await requireSuperadmin()
  const id = normalizeId(formData.get('id'))

  if (!id) {
    redirect(getMessagePath('error', 'Image ID is required for delete.'))
  }

  const { error } = await supabase
    .from('images')
    .delete()
    .eq('id', id)

  if (error) {
    redirect(getMessagePath('error', `Delete failed: ${error.message}`))
  }

  revalidatePath('/admin')
  revalidatePath('/admin/images')
  redirect(getMessagePath('success', `Image ${id.slice(0, 8)} deleted.`))
}
