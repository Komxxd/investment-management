export function calculateXIRR(cashFlows: { amount: number, date: number }[], guess = 0.1): number {
  if (cashFlows.length < 2) return 0;
  
  const minDate = Math.min(...cashFlows.map(cf => cf.date));
  
  const maxIterations = 100;
  const tolerance = 1e-5;
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    let fValue = 0;
    let fDerivative = 0;
    
    for (const cf of cashFlows) {
      const days = (cf.date - minDate) / (1000 * 60 * 60 * 24);
      const years = days / 365;
      
      fValue += cf.amount / Math.pow(1 + rate, years);
      if (years > 0) {
        fDerivative -= (years * cf.amount) / Math.pow(1 + rate, years + 1);
      }
    }
    
    if (Math.abs(fValue) < tolerance) {
      return rate;
    }
    
    if (fDerivative === 0) break;
    
    const nextRate = rate - fValue / fDerivative;
    if (Math.abs(nextRate - rate) < tolerance) {
      return nextRate;
    }
    
    if (nextRate <= -1) {
      rate = -0.999999;
    } else {
      rate = nextRate;
    }
  }
  
  return rate;
}
