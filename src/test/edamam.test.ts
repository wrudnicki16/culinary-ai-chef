import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We'll mock global fetch; env vars are controlled per test
const MOCK_EDAMAM_RESPONSE = {
  calories: 812,
  totalNutrients: {
    PROCNT: { label: 'Protein', quantity: 62.4, unit: 'g' },
    FAT: { label: 'Fat', quantity: 30.1, unit: 'g' },
    CHOCDF: { label: 'Carbs', quantity: 78.5, unit: 'g' },
    FIBTG: { label: 'Fiber', quantity: 6.2, unit: 'g' },
  },
}

const TEST_INGREDIENTS = [
  { name: 'chicken breast', quantity: '1 lb' },
  { name: 'rice', quantity: '2 cups' },
  { name: 'olive oil', quantity: '2 tbsp' },
]

describe('analyzeNutritionWithEdamam', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      EDAMAM_APP_ID: 'test-app-id',
      EDAMAM_APP_KEY: 'test-app-key',
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('returns null when env vars are missing', async () => {
    delete process.env.EDAMAM_APP_ID
    delete process.env.EDAMAM_APP_KEY
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    const result = await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)
    expect(result).toBeNull()
  })

  it('formats ingredient strings as "quantity name"', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_EDAMAM_RESPONSE), { status: 200 })
    )
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(body.ingr).toEqual([
      '1 lb chicken breast',
      '2 cups rice',
      '2 tbsp olive oil',
    ])
  })

  it('maps Edamam response to NutritionInfo with per-serving values', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_EDAMAM_RESPONSE), { status: 200 })
    )
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    const result = await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)

    expect(result).toEqual({
      calories: Math.round(812 / 4),
      protein: Math.round(62.4 / 4),
      fat: Math.round(30.1 / 4),
      carbs: Math.round(78.5 / 4),
      fiber: Math.round(6.2 / 4),
    })
  })

  it('returns null and warns on API error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Rate limit exceeded', { status: 429 })
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    const result = await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Edamam API error')
    )
  })

  it('returns null and warns on network failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    const result = await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Edamam API error')
    )
  })

  it('returns null and warns on malformed response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ unexpected: 'shape' }), { status: 200 })
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { analyzeNutritionWithEdamam } = await import('@/lib/edamam')

    const result = await analyzeNutritionWithEdamam(TEST_INGREDIENTS, 4)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Edamam API error')
    )
  })
})
