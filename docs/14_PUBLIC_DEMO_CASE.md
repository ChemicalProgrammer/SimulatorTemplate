# Public demonstration Case

The console can create **Public 13-unit demo** from the Cases panel. It is a complete, runnable demonstration Case for testing the editor, playback, physical conveyor geometry, seeded micro-stops, and reliability events without adding confidential plant data.

## Data boundary

The Case is labelled `PUBLIC_DEMONSTRATION_ONLY` and carries its own `metadata.dataNote` and public reference links. Public Krones pages provide broad equipment-capacity context for blow moulding, filling, packing, and palletising. They do not provide the specification of one integrated line.

Therefore, its MTBF, MTTR, physical geometry, sensor positions, speed factors, pack configuration, and equivalent-flow values are deliberately marked as transparent **synthetic assumptions**. They must not be used as a design limit, a plant benchmark, or a CAPEX recommendation.

## What runs in the MVP

The engine models every step as an equivalent-bottle flow. The six conveyor objects use mandatory synthetic physical geometry and control parameters. It does not yet transform bottles into cases or pallets; the pack configuration is stored only as an explicit model assumption.

| Input | Current deterministic behaviour |
|---|---|
| `noiseProfile.microStop` | Seeded short stops, driven by probability per minute and a duration range. |
| `noiseProfile.reliability.mtbfMinutes` | Seeded exponential time-to-failure while the unit is operational. |
| `noiseProfile.reliability.mttrMinutes` | Fixed repair duration after a generated failure. |
| `processData.accumulation` on each demo conveyor | Mandatory physical capacity from length/pitch, leading-product travel to Prime, Back-up controlled stop, restart hysteresis, and residual-discharge overflow accounting. |

Using a fixed random seed makes the same Case and run configuration repeat exactly. Change the seed to observe another plausible realization of the declared assumptions.

## Deliberately unknown fields

LACT, LP Prime, and the four unnamed Speed & sensors fields remain `null` or empty. Their meanings were not supplied, so the demo does not invent field definitions or values for them.

## Public context references

- [Krones Contiform Speed](https://www.krones.com/en/products/machines/contiform-speed-stretch-blow-moulder.php)
- [Krones Modulfill Dual](https://www.krones.com/en/products/machines/modulfill-dual.php)
- [Krones packaging-line reference](https://www.krones.com/en/company/press/magazine/reference/coca-cola-hbc-egypts-fastest-canning-line.php)
- [Krones Modulpal Pro](https://www.krones.com/en/products/machines/modulpal-pro-palletiser.php)
