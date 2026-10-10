import { describe, expect, it } from 'vitest'
import { normalizeStageFolderMap, stageCodeFromFolderName } from './drive-utils'

describe('drive utils', () => {
  it('detecta códigos numéricos y alfanuméricos de carpetas de etapa', () => {
    expect(stageCodeFromFolderName('01_Ingeniería')).toBe('01')
    expect(stageCodeFromFolderName('04-Ejecución')).toBe('04')
    expect(stageCodeFromFolderName('EV Ejecución versionada')).toBe('EV')
    expect(stageCodeFromFolderName('Planos')).toBeNull()
  })

  it('normaliza solo entradas válidas del mapa de carpetas', () => {
    expect(normalizeStageFolderMap({
      'stage-1': { id: 'folder-1', name: '01_Ingeniería', path: '/01_Ingeniería' },
      broken: { id: 'missing-fields' },
    })).toEqual({
      'stage-1': { id: 'folder-1', name: '01_Ingeniería', path: '/01_Ingeniería' },
    })
  })
})
