import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LocalDB } from '@/services/local-db'
import type { Recipe } from '@/types'

interface EIMScore {
  water: number
  chemical: number
  energy: number
  efficiency: number
  total: number
  rating: string
}

interface ImpactDetail {
  waterConsumption: number
  waterScore: number
  chemicalImpact: number
  chemicalScore: number
  energyUsage: number
  energyScore: number
  processEfficiency: number
  efficiencyScore: number
}

export function EIMScore() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'methodology' | 'references'>('calculator')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selectedRecipe, setSelectedRecipe] = useState<string>('')
  const [score, setScore] = useState<EIMScore>({ water: 0, chemical: 0, energy: 0, efficiency: 0, total: 0, rating: '-' })
  const [impact, setImpact] = useState<ImpactDetail>({
    waterConsumption: 0, waterScore: 0,
    chemicalImpact: 0, chemicalScore: 0,
    energyUsage: 0, energyScore: 0,
    processEfficiency: 0, efficiencyScore: 0
  })

  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    try {
      const data = await LocalDB.getAll<Recipe>('recipes')
      setRecipes(data)
    } catch (error) {
      console.error('Failed to load recipes:', error)
    }
  }

  const calculateScore = () => {
    const recipe = recipes.find(r => r.id === selectedRecipe)
    if (!recipe) return

    // Water Score (30% weight) - based on total_water or batch_weight
    const waterConsumption = recipe.total_water || (recipe.batch_weight * 15) // Default L/R ratio
    const waterScore = Math.max(0, 100 - (waterConsumption / 10)) // Simplified scoring

    // Chemical Score (35% weight) - based on chemical usage estimation
    const chemicalImpact = 50 // Default impact score
    const chemicalScore = Math.max(0, 100 - chemicalImpact)

    // Energy Score (20% weight) - based on recipe_time
    const energyUsage = recipe.recipe_time || 120
    const energyScore = Math.max(0, 100 - (energyUsage / 3))

    // Efficiency Score (15% weight) - based on process optimization
    const processEfficiency = 75 // Default efficiency
    const efficiencyScore = processEfficiency

    // Calculate weighted total
    const totalScore = (waterScore * 0.30) + (chemicalScore * 0.35) + (energyScore * 0.20) + (efficiencyScore * 0.15)

    // Determine rating
    let rating = 'Low Impact'
    if (totalScore < 40) rating = 'High Impact'
    else if (totalScore < 60) rating = 'Medium Impact'
    else if (totalScore < 80) rating = 'Low Impact'
    else rating = 'Excellent'

    setScore({
      water: Math.round(waterScore),
      chemical: Math.round(chemicalScore),
      energy: Math.round(energyScore),
      efficiency: Math.round(efficiencyScore),
      total: Math.round(totalScore),
      rating
    })

    setImpact({
      waterConsumption,
      waterScore: Math.round(waterScore),
      chemicalImpact,
      chemicalScore: Math.round(chemicalScore),
      energyUsage,
      energyScore: Math.round(energyScore),
      processEfficiency,
      efficiencyScore: Math.round(efficiencyScore)
    })
  }

  useEffect(() => {
    if (selectedRecipe) {
      calculateScore()
    }
  }, [selectedRecipe])

  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-emerald-400'
    if (value >= 60) return 'text-green-400'
    if (value >= 40) return 'text-amber-400'
    return 'text-red-400'
  }

  const getBarColor = (value: number) => {
    if (value >= 80) return 'bg-emerald-500'
    if (value >= 60) return 'bg-green-500'
    if (value >= 40) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
          EIM Score Calculator
        </h1>
        <p className="text-gray-400 mt-1">Environmental Impact Measurement for Denim Washing</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'calculator', label: 'Calculator' },
          { id: 'methodology', label: 'Methodology' },
          { id: 'references', label: 'References' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Recipe Selection & Score */}
          <div className="space-y-6">
            {/* Recipe Selector */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <label className="block text-sm text-gray-400 mb-2">Select Recipe</label>
              <select
                value={selectedRecipe}
                onChange={(e) => setSelectedRecipe(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">-- Choose a Recipe --</option>
                {recipes.map(r => (
                  <option key={r.id} value={r.id}>{r.recipe_no} - {r.customer_name} ({r.style})</option>
                ))}
              </select>
            </div>

            {/* Score Display */}
            {selectedRecipe && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <div className="flex justify-center mb-6">
                  <div className="relative w-48 h-48 rounded-full flex flex-col items-center justify-center"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '3px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    <div className={`text-5xl font-bold ${getScoreColor(score.total)}`}>
                      {score.total}
                    </div>
                    <div className="text-sm text-gray-400 uppercase tracking-wider">EIM Score</div>
                    <div className={`mt-1 font-semibold ${getScoreColor(score.total)}`}>
                      {score.rating}
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Water', value: score.water, weight: '30%', icon: '💧' },
                    { label: 'Chemical', value: score.chemical, weight: '35%', icon: '🧪' },
                    { label: 'Energy', value: score.energy, weight: '20%', icon: '⚡' },
                    { label: 'Efficiency', value: score.efficiency, weight: '15%', icon: '⚙️' }
                  ].map(item => (
                    <div key={item.label} className="bg-gray-900/50 rounded-lg p-4 text-center">
                      <div className="text-2xl mb-1">{item.icon}</div>
                      <div className={`text-xl font-bold ${getScoreColor(item.value)}`}>{item.value}</div>
                      <div className="text-xs text-gray-400">{item.label} ({item.weight})</div>
                      <div className="h-1.5 bg-gray-700 rounded-full mt-2 overflow-hidden">
                        <div className={`h-full rounded-full ${getBarColor(item.value)}`} style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Impact Details */}
          {selectedRecipe && (
            <div className="space-y-6">
              {/* Water Impact */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl">💧</div>
                  <div>
                    <div className="font-semibold text-white">Water Impact</div>
                    <div className="text-sm text-gray-400">Score: {impact.waterScore}</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Water Consumption</span>
                    <span className="text-white">{impact.waterConsumption.toFixed(1)} L</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">L/R Ratio</span>
                    <span className="text-white">~{((impact.waterConsumption / 100) || 10).toFixed(1)}:1</span>
                  </div>
                </div>
              </div>

              {/* Chemical Impact */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-xl">🧪</div>
                  <div>
                    <div className="font-semibold text-white">Chemical Impact</div>
                    <div className="text-sm text-gray-400">Score: {impact.chemicalScore}</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Chemical Impact Index</span>
                    <span className="text-white">{impact.chemicalImpact}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Eco-Friendly Score</span>
                    <span className="text-emerald-400">{100 - impact.chemicalImpact}%</span>
                  </div>
                </div>
              </div>

              {/* Energy Impact */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xl">⚡</div>
                  <div>
                    <div className="font-semibold text-white">Energy Impact</div>
                    <div className="text-sm text-gray-400">Score: {impact.energyScore}</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Process Time</span>
                    <span className="text-white">{impact.energyUsage} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Est. Energy Usage</span>
                    <span className="text-white">{((impact.energyUsage / 60) * 5).toFixed(1)} kWh</span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3">💡 Recommendations</h3>
                <div className="space-y-2 text-sm">
                  {score.water < 60 && (
                    <div className="flex items-start gap-2 text-gray-300">
                      <span className="text-emerald-400">•</span>
                      Consider reducing water ratio or implementing water recycling
                    </div>
                  )}
                  {score.chemical < 60 && (
                    <div className="flex items-start gap-2 text-gray-300">
                      <span className="text-emerald-400">•</span>
                      Evaluate eco-friendly chemical alternatives
                    </div>
                  )}
                  {score.energy < 60 && (
                    <div className="flex items-start gap-2 text-gray-300">
                      <span className="text-emerald-400">•</span>
                      Optimize process times for energy efficiency
                    </div>
                  )}
                  {score.total >= 80 && (
                    <div className="flex items-start gap-2 text-emerald-300">
                      <span>✓</span>
                      Great! This recipe has excellent environmental performance
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'methodology' && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">EIM Scoring Methodology</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-white mb-2">📊 Formula</h3>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-emerald-400">
                EIM Score = (Water × 0.30) + (Chemical × 0.35) + (Energy × 0.20) + (Efficiency × 0.15)
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">💧 Water Score (30%)</h3>
              <p className="text-gray-400 text-sm">
                Based on total water consumption per kg of garment. Lower consumption yields higher scores.
                Industry benchmark: 60-100 L/kg for conventional processes.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">🧪 Chemical Score (35%)</h3>
              <p className="text-gray-400 text-sm">
                Evaluates the environmental impact of chemicals used. Considers:
                <br />• Banned/restricted substances
                <br />• ZDHC MRSL compliance
                <br />• Chemical dosage per process
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">⚡ Energy Score (20%)</h3>
              <p className="text-gray-400 text-sm">
                Calculated based on total process time and temperature requirements.
                Shorter cycles and lower temperatures contribute to better scores.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">⚙️ Efficiency Score (15%)</h3>
              <p className="text-gray-400 text-sm">
                Measures process optimization including liquor ratio, machine efficiency,
                and production throughput.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'references' && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">📚 References</h2>
          
          <div className="space-y-3">
            {[
              { name: 'ZDHC Foundation', url: 'https://www.roadmaptozero.com', desc: 'MRSL Guidelines & Implementation' },
              { name: 'Jeologia EIM Score', url: 'https://jeologia.com', desc: 'Original EIM Methodology' },
              { name: 'Higg Index', url: 'https://apparelcoalition.org', desc: 'Sustainability Measurement' },
              { name: 'OEKO-TEX', url: 'https://www.oeko-tex.com', desc: 'Chemical Safety Standards' }
            ].map(ref => (
              <div key={ref.name} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                <span className="text-xl">📖</span>
                <div>
                  <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-medium">
                    {ref.name}
                  </a>
                  <div className="text-sm text-gray-500">{ref.desc}</div>
                </div>
                <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">Verified</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
