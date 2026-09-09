function createReferenceCaseRequest_() {
  var suffix = new Date().getTime().toString();
  return {
    id: 'reference-packaging-line-' + suffix,
    name: 'Reference packaging line',
    unitOfFlow: 'bottles',
    equipment: [
      { id: 'blower-1', type: 'BLOWER', name: 'Blower', nominalRatePerSecond: 20, bufferAfterCapacity: 100, initialMode: 'AUTO' },
      { id: 'conveyor-1', type: 'CONVEYOR', name: 'Infeed conveyor', nominalRatePerSecond: 100, bufferAfterCapacity: 300, initialMode: 'AUTO' },
      { id: 'pacemaker-1', type: 'PACEMAKER', name: 'Pacemaker', nominalRatePerSecond: 25, bufferAfterCapacity: 80, initialMode: 'AUTO' },
      { id: 'conveyor-2', type: 'CONVEYOR', name: 'Discharge conveyor', nominalRatePerSecond: 100, bufferAfterCapacity: 120, initialMode: 'AUTO' },
      { id: 'palletizer-1', type: 'PALLETIZER', name: 'Palletizer', nominalRatePerSecond: 25, bufferAfterCapacity: 0, initialMode: 'AUTO' }
    ]
  };
}
