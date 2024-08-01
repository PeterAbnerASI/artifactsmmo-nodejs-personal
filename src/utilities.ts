

export const expectedTryCountForDrop = (rate: number, min_quantity: number, max_quantity: number, target: number) => {
  const probability = 1 / rate
  const mean = (min_quantity + max_quantity) / 2
  return Math.ceil(target / probability / mean)
}