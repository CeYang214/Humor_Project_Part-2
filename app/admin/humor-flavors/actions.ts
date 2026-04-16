'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  FLAVOR_NAME_COLUMN_CANDIDATES,
  HUMOR_FLAVOR_STEP_TABLE_CANDIDATES,
  HUMOR_FLAVOR_TABLE_CANDIDATES,
  STEP_FLAVOR_COLUMN_CANDIDATES,
  STEP_ORDER_COLUMN_CANDIDATES,
  asCleanString,
  parseJsonObjectOrThrow,
  pickFirstExistingColumn,
  pickFlavorName,
  pickIdentifierColumn,
  pickStepOrderValue,
  resolveFirstExistingTable,
  sortStepsByOrder,
} from '@/lib/admin/humor-flavors'
import { requireSuperadminOrMatrixAdmin } from '@/lib/supabase/admin'

type ActionStatus = 'success' | 'error'

function normalizeText(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function getMessagePath(status: ActionStatus, message: string, flavorId?: string) {
  const flavorSegment = flavorId ? `&flavor=${encodeURIComponent(flavorId)}` : ''
  return `/admin/humor-flavors?status=${status}&message=${encodeURIComponent(message)}${flavorSegment}`
}

function parseMaybeJson(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

function withCreateAuditFields(payload: Record<string, unknown>, userId: string) {
  return {
    ...payload,
    created_by_user_id: userId,
    modified_by_user_id: userId,
  }
}

function withUpdateAuditFields(payload: Record<string, unknown>, userId: string) {
  return {
    ...payload,
    modified_by_user_id: userId,
  }
}

const DUPLICATE_EXCLUDED_COLUMNS = [
  'id',
  'created_at',
  'created_datetime_utc',
  'created_date',
  'created_on',
  'modified_at',
  'modified_datetime_utc',
  'updated_at',
  'updated_datetime_utc',
]

function stripDuplicateSystemColumns(row: Record<string, unknown>, idColumn: string) {
  const payload = { ...row }
  for (const key of new Set([...DUPLICATE_EXCLUDED_COLUMNS, idColumn])) {
    delete payload[key]
  }
  return payload
}

async function resolveFlavorTableOrThrow() {
  const { supabase, user } = await requireSuperadminOrMatrixAdmin()
  const resolution = await resolveFirstExistingTable(supabase, HUMOR_FLAVOR_TABLE_CANDIDATES)

  if (!resolution.tableName) {
    throw new Error(resolution.errorMessage ?? 'Unable to find humor flavor table.')
  }

  return { supabase, user, tableName: resolution.tableName }
}

async function resolveStepTableOrThrow() {
  const { supabase, user } = await requireSuperadminOrMatrixAdmin()
  const resolution = await resolveFirstExistingTable(supabase, HUMOR_FLAVOR_STEP_TABLE_CANDIDATES)

  if (!resolution.tableName) {
    throw new Error(resolution.errorMessage ?? 'Unable to find humor flavor steps table.')
  }

  return { supabase, user, tableName: resolution.tableName }
}

function revalidateAdminRoutes() {
  revalidatePath('/admin')
  revalidatePath('/admin/operations')
  revalidatePath('/admin/humor-flavors')
  revalidatePath('/admin/captions')
}

export async function createHumorFlavorAction(formData: FormData) {
  try {
    const payload = parseJsonObjectOrThrow(normalizeText(formData.get('payload')))
    const { supabase, user, tableName } = await resolveFlavorTableOrThrow()

    const { data, error } = await supabase
      .from(tableName)
      .insert(withCreateAuditFields(payload, user.id))
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    const flavorId = asCleanString(data?.id ?? payload.id)
    revalidateAdminRoutes()
    redirect(getMessagePath('success', 'Humor flavor created.', flavorId))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create humor flavor.'
    redirect(getMessagePath('error', message))
  }
}

export async function updateHumorFlavorAction(formData: FormData) {
  const flavorId = normalizeText(formData.get('flavor_id'))
  const idColumn = normalizeText(formData.get('id_column')) || 'id'

  try {
    if (!flavorId) {
      throw new Error('Flavor id is required.')
    }

    const payload = parseJsonObjectOrThrow(normalizeText(formData.get('payload')))
    const { supabase, user, tableName } = await resolveFlavorTableOrThrow()

    const { error } = await supabase
      .from(tableName)
      .update(withUpdateAuditFields(payload, user.id))
      .eq(idColumn, parseMaybeJson(flavorId))

    if (error) {
      throw new Error(error.message)
    }

    revalidateAdminRoutes()
    redirect(getMessagePath('success', 'Humor flavor updated.', flavorId))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update humor flavor.'
    redirect(getMessagePath('error', message, flavorId))
  }
}

export async function deleteHumorFlavorAction(formData: FormData) {
  const flavorId = normalizeText(formData.get('flavor_id'))
  const idColumn = normalizeText(formData.get('id_column')) || 'id'

  try {
    if (!flavorId) {
      throw new Error('Flavor id is required.')
    }

    const { supabase, tableName } = await resolveFlavorTableOrThrow()
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq(idColumn, parseMaybeJson(flavorId))

    if (error) {
      throw new Error(error.message)
    }

    revalidateAdminRoutes()
    redirect(getMessagePath('success', 'Humor flavor deleted.'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete humor flavor.'
    redirect(getMessagePath('error', message, flavorId))
  }
}

export async function duplicateHumorFlavorAction(formData: FormData) {
  const sourceFlavorId = normalizeText(formData.get('source_flavor_id'))
  const sourceFlavorName = normalizeText(formData.get('source_flavor_name'))
  const newFlavorName = normalizeText(formData.get('new_flavor_name'))
  const idColumn = normalizeText(formData.get('id_column')) || 'id'
  const suppliedFlavorNameColumn = normalizeText(formData.get('flavor_name_column'))
  const suppliedStepFlavorColumn = normalizeText(formData.get('step_flavor_column'))
  const suppliedStepIdColumn = normalizeText(formData.get('step_id_column'))
  const suppliedStepOrderColumn = normalizeText(formData.get('step_order_column'))

  try {
    if (!sourceFlavorId) {
      throw new Error('Source flavor id is required.')
    }

    if (!newFlavorName) {
      throw new Error('New flavor name is required.')
    }

    const { supabase, user, tableName: flavorTableName } = await resolveFlavorTableOrThrow()
    const stepResolution = await resolveFirstExistingTable(supabase, HUMOR_FLAVOR_STEP_TABLE_CANDIDATES)
    if (!stepResolution.tableName) {
      throw new Error(stepResolution.errorMessage ?? 'Unable to find humor flavor steps table.')
    }
    const stepTableName = stepResolution.tableName

    const { data: flavorRowsData, error: flavorRowsError } = await supabase.from(flavorTableName).select('*').limit(2000)
    if (flavorRowsError) {
      throw new Error(flavorRowsError.message)
    }
    const flavorRows = (flavorRowsData ?? []) as Record<string, unknown>[]

    const flavorNameColumn = suppliedFlavorNameColumn || pickFirstExistingColumn(flavorRows, FLAVOR_NAME_COLUMN_CANDIDATES) || 'name'
    const duplicateExists = flavorRows.some(
      (row) => asCleanString(row[flavorNameColumn]).toLowerCase() === newFlavorName.toLowerCase()
    )
    if (duplicateExists) {
      throw new Error(`Flavor name "${newFlavorName}" already exists. Choose a different name.`)
    }

    let sourceFlavorRow = flavorRows.find((row) => asCleanString(row[idColumn]) === sourceFlavorId) ?? null
    if (!sourceFlavorRow) {
      const { data: fallbackRow, error: fallbackError } = await supabase
        .from(flavorTableName)
        .select('*')
        .eq(idColumn, parseMaybeJson(sourceFlavorId))
        .limit(1)
        .maybeSingle()

      if (fallbackError) {
        throw new Error(fallbackError.message)
      }
      sourceFlavorRow = (fallbackRow as Record<string, unknown> | null) ?? null
    }

    if (!sourceFlavorRow) {
      throw new Error('Source flavor was not found.')
    }

    const sourceFlavorDisplayName = sourceFlavorName || pickFlavorName(sourceFlavorRow)
    const duplicateFlavorPayload = stripDuplicateSystemColumns(sourceFlavorRow, idColumn)
    duplicateFlavorPayload[flavorNameColumn] = newFlavorName

    const { data: insertedFlavor, error: insertFlavorError } = await supabase
      .from(flavorTableName)
      .insert(withCreateAuditFields(duplicateFlavorPayload, user.id))
      .select('*')
      .limit(1)
      .maybeSingle()

    if (insertFlavorError) {
      throw new Error(insertFlavorError.message)
    }

    const newFlavorId = asCleanString(insertedFlavor?.[idColumn] ?? insertedFlavor?.id)
    if (!newFlavorId) {
      throw new Error('Duplicate flavor created, but the new flavor id could not be determined.')
    }

    const { data: stepRowsData, error: stepRowsError } = await supabase.from(stepTableName).select('*').limit(3000)
    if (stepRowsError) {
      await supabase.from(flavorTableName).delete().eq(idColumn, parseMaybeJson(newFlavorId))
      throw new Error(stepRowsError.message)
    }

    const stepRows = (stepRowsData ?? []) as Record<string, unknown>[]
    const stepFlavorColumn = suppliedStepFlavorColumn || STEP_FLAVOR_COLUMN_CANDIDATES.find((candidate) => stepRows.some((row) => candidate in row)) || 'humor_flavor_id'
    const stepIdColumn = suppliedStepIdColumn || pickIdentifierColumn(stepRows)
    const stepOrderColumn = suppliedStepOrderColumn || STEP_ORDER_COLUMN_CANDIDATES.find((candidate) => stepRows.some((row) => candidate in row)) || 'step_order'

    const sourceSteps = sortStepsByOrder(
      stepRows.filter((row) => {
        if (!(stepFlavorColumn in row)) return false
        const value = asCleanString(row[stepFlavorColumn])
        return value === sourceFlavorId || value === sourceFlavorDisplayName
      }),
      stepOrderColumn
    )

    if (sourceSteps.length > 0) {
      const clonedStepPayloads = sourceSteps.map((row) => {
        const payload = stripDuplicateSystemColumns(row, stepIdColumn)
        const existingStepFlavorRef = asCleanString(row[stepFlavorColumn])
        payload[stepFlavorColumn] =
          existingStepFlavorRef === sourceFlavorDisplayName && sourceFlavorDisplayName
            ? newFlavorName
            : parseMaybeJson(newFlavorId)
        return withCreateAuditFields(payload, user.id)
      })

      const { error: insertStepsError } = await supabase.from(stepTableName).insert(clonedStepPayloads)
      if (insertStepsError) {
        await supabase.from(flavorTableName).delete().eq(idColumn, parseMaybeJson(newFlavorId))
        throw new Error(`Failed to duplicate flavor steps: ${insertStepsError.message}`)
      }
    }

    revalidateAdminRoutes()
    redirect(getMessagePath('success', `Flavor duplicated with ${sourceSteps.length} step(s).`, newFlavorId))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to duplicate humor flavor.'
    redirect(getMessagePath('error', message, sourceFlavorId))
  }
}

async function resolveDefaultStepColumns(
  supabase: Awaited<ReturnType<typeof requireSuperadminOrMatrixAdmin>>['supabase'],
  tableName: string
) {
  const { data, error } = await supabase.from(tableName).select('*').limit(250)
  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const flavorColumn = STEP_FLAVOR_COLUMN_CANDIDATES.find((candidate) => rows.some((row) => candidate in row)) ?? 'humor_flavor_id'
  const orderColumn = STEP_ORDER_COLUMN_CANDIDATES.find((candidate) => rows.some((row) => candidate in row)) ?? 'step_order'

  return { flavorColumn, orderColumn }
}

async function getNextStepOrder(
  supabase: Awaited<ReturnType<typeof requireSuperadminOrMatrixAdmin>>['supabase'],
  tableName: string,
  flavorColumn: string,
  flavorId: string,
  orderColumn: string
) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq(flavorColumn, parseMaybeJson(flavorId))
    .limit(500)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  let maxOrder = 0
  for (const row of rows) {
    const orderValue = pickStepOrderValue(row, orderColumn)
    if (Number.isFinite(orderValue) && orderValue > maxOrder && orderValue < Number.MAX_SAFE_INTEGER) {
      maxOrder = orderValue
    }
  }

  return maxOrder + 1
}

export async function createHumorFlavorStepAction(formData: FormData) {
  const flavorId = normalizeText(formData.get('flavor_id'))
  const suppliedFlavorColumn = normalizeText(formData.get('flavor_column'))
  const suppliedOrderColumn = normalizeText(formData.get('order_column'))

  try {
    const payload = parseJsonObjectOrThrow(normalizeText(formData.get('payload')))
    const { supabase, user, tableName } = await resolveStepTableOrThrow()
    const defaults = await resolveDefaultStepColumns(supabase, tableName)
    const flavorColumn = suppliedFlavorColumn || defaults.flavorColumn
    const orderColumn = suppliedOrderColumn || defaults.orderColumn

    if (flavorId && !(flavorColumn in payload)) {
      payload[flavorColumn] = parseMaybeJson(flavorId)
    }

    if (flavorId && !(orderColumn in payload)) {
      payload[orderColumn] = await getNextStepOrder(supabase, tableName, flavorColumn, flavorId, orderColumn)
    }

    const { error } = await supabase
      .from(tableName)
      .insert(withCreateAuditFields(payload, user.id))

    if (error) {
      throw new Error(error.message)
    }

    revalidateAdminRoutes()
    redirect(getMessagePath('success', 'Humor flavor step created.', flavorId))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create humor flavor step.'
    redirect(getMessagePath('error', message, flavorId))
  }
}

export async function updateHumorFlavorStepAction(formData: FormData) {
  const flavorId = normalizeText(formData.get('flavor_id'))
  const stepId = normalizeText(formData.get('step_id'))
  const idColumn = normalizeText(formData.get('id_column')) || 'id'

  try {
    if (!stepId) {
      throw new Error('Step id is required.')
    }

    const payload = parseJsonObjectOrThrow(normalizeText(formData.get('payload')))
    const { supabase, user, tableName } = await resolveStepTableOrThrow()

    const { error } = await supabase
      .from(tableName)
      .update(withUpdateAuditFields(payload, user.id))
      .eq(idColumn, parseMaybeJson(stepId))

    if (error) {
      throw new Error(error.message)
    }

    revalidateAdminRoutes()
    redirect(getMessagePath('success', 'Humor flavor step updated.', flavorId))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update humor flavor step.'
    redirect(getMessagePath('error', message, flavorId))
  }
}

export async function deleteHumorFlavorStepAction(formData: FormData) {
  const flavorId = normalizeText(formData.get('flavor_id'))
  const stepId = normalizeText(formData.get('step_id'))
  const idColumn = normalizeText(formData.get('id_column')) || 'id'

  try {
    if (!stepId) {
      throw new Error('Step id is required.')
    }

    const { supabase, tableName } = await resolveStepTableOrThrow()

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq(idColumn, parseMaybeJson(stepId))

    if (error) {
      throw new Error(error.message)
    }

    revalidateAdminRoutes()
    redirect(getMessagePath('success', 'Humor flavor step deleted.', flavorId))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete humor flavor step.'
    redirect(getMessagePath('error', message, flavorId))
  }
}

export async function moveHumorFlavorStepAction(formData: FormData) {
  const flavorId = normalizeText(formData.get('flavor_id'))
  const stepId = normalizeText(formData.get('step_id'))
  const direction = normalizeText(formData.get('direction'))
  const targetPositionRaw = normalizeText(formData.get('target_position'))
  const idColumn = normalizeText(formData.get('id_column')) || 'id'
  const flavorColumn = normalizeText(formData.get('flavor_column')) || 'humor_flavor_id'
  const orderColumn = normalizeText(formData.get('order_column')) || 'step_order'

  try {
    if (!flavorId) {
      throw new Error('Flavor id is required.')
    }

    if (!stepId) {
      throw new Error('Step id is required.')
    }

    const { supabase, user, tableName } = await resolveStepTableOrThrow()
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(flavorColumn, parseMaybeJson(flavorId))
      .limit(1000)

    if (error) {
      throw new Error(error.message)
    }

    const rows = sortStepsByOrder((data ?? []) as Record<string, unknown>[], orderColumn)
    const currentIndex = rows.findIndex((row) => asCleanString(row[idColumn]) === stepId)

    if (currentIndex < 0) {
      throw new Error('Step was not found in current flavor steps.')
    }

    let nextIndex = currentIndex
    if (direction === 'up') {
      nextIndex = Math.max(0, currentIndex - 1)
    } else if (direction === 'down') {
      nextIndex = Math.min(rows.length - 1, currentIndex + 1)
    } else if (targetPositionRaw) {
      const parsedTarget = Number.parseInt(targetPositionRaw, 10)
      if (Number.isNaN(parsedTarget)) {
        throw new Error('Target position must be a number.')
      }
      nextIndex = Math.min(Math.max(parsedTarget - 1, 0), rows.length - 1)
    }

    if (nextIndex === currentIndex) {
      redirect(getMessagePath('success', 'Step order unchanged.', flavorId))
    }

    const reordered = [...rows]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, moved)

    const updates = reordered
      .map((row, index) => ({
        idValue: row[idColumn],
        nextOrder: index + 1,
        currentOrder: pickStepOrderValue(row, orderColumn),
      }))
      .filter((item) => item.idValue !== undefined)
      .filter((item) => item.currentOrder !== item.nextOrder)

    for (const item of updates) {
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          [orderColumn]: item.nextOrder,
          modified_by_user_id: user.id,
        })
        .eq(idColumn, item.idValue)

      if (updateError) {
        throw new Error(updateError.message)
      }
    }

    revalidateAdminRoutes()
    redirect(getMessagePath('success', 'Step order updated.', flavorId))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reorder flavor steps.'
    redirect(getMessagePath('error', message, flavorId))
  }
}
