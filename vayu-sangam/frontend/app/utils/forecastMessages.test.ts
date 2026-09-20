import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getTrendArrow, getUncertaintyMessage, getScientificStatus, getPollutantAvailability } from './forecastMessages';

describe('forecastMessages utilities', () => {
  describe('getTrendArrow', () => {
    it('should return Badhegi for >10% increase', () => {
      assert.deepStrictEqual(getTrendArrow(100, 115), { icon: '📈', text: 'Badhegi (AQI badhega)' });
    });
    it('should return Kam-hogi for >10% decrease', () => {
      assert.deepStrictEqual(getTrendArrow(100, 85), { icon: '📉', text: 'Kam-hogi (Sudhar aayega)' });
    });
    it('should return Waisi-hi-rahegi for <10% change', () => {
      assert.deepStrictEqual(getTrendArrow(100, 105), { icon: '➡️', text: 'Waisi-hi-rahegi' });
      assert.deepStrictEqual(getTrendArrow(100, 95), { icon: '➡️', text: 'Waisi-hi-rahegi' });
    });
    it('should handle missing data safely', () => {
      assert.deepStrictEqual(getTrendArrow(0, 100), { icon: '➡️', text: 'Data missing' });
    });
  });

  describe('getUncertaintyMessage', () => {
    it('should return KAAFI SURE for <15% band width', () => {
      assert.strictEqual(getUncertaintyMessage(95, 105, 100), 'Hum is forecast ke baare mein KAAFI SURE hain');
    });
    it('should return THODA SURE for <40% band width', () => {
      assert.strictEqual(getUncertaintyMessage(85, 115, 100), 'Hum is forecast ke baare mein THODA SURE hain');
    });
    it('should return ROUGH ANDAAZA for >40% band width', () => {
      assert.strictEqual(getUncertaintyMessage(50, 150, 100), 'Ye EK ROUGH ANDAAZA hai, moshkil mausam ke karan exact nahi');
    });
  });

  describe('getScientificStatus', () => {
    it('should handle live scenario and expose AQI', () => {
      const res = getScientificStatus('xgboost_live_inference', 'Live forecast R2=0.97', 250, 24);
      assert.ok(res.simple.includes('Live Forecast (Abhi ka AQI 250 hai'));
      assert.strictEqual(res.technical, 'Live forecast R2=0.97');
    });

    it('should safely ignore stale AQI in insufficient_data fallback and output numeric history', () => {
      const res = getScientificStatus('bundled_demo_dataset', 'insufficient_data: 10/24h.', 999, 10);
      assert.ok(res.simple.includes('10/24'));
      assert.ok(!res.simple.includes('999')); // AQI must be explicitly ignored to prevent leak
    });

    it('should handle non-numeric fallback without fake generic claims', () => {
      const res = getScientificStatus('bundled_demo_dataset', 'insufficient_data: Exception in live inference', 999, null);
      assert.ok(res.simple.includes('Abhi technical issue ki wajah se sample data dikha rahe hain'));
      assert.ok(!res.simple.includes('999'));
      assert.ok(!res.simple.includes('24/24')); // No fake numeric injection
    });
  });

  describe('getPollutantAvailability', () => {
    it('should dynamically check array for non-null values', () => {
      const forecast = [
        { pm25_ug_m3: 10, no2_ug_m3: null, so2_ug_m3: null },
        { pm25_ug_m3: 12, no2_ug_m3: 5, so2_ug_m3: null } 
      ];
      const res = getPollutantAvailability(forecast);
      assert.strictEqual(res.pm25, true);
      assert.strictEqual(res.no2, true);
      assert.strictEqual(res.so2, false);
    });
  });
});
