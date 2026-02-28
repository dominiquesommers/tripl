export interface ICostBreakdown {
  accommodation: number;
  transport: number;
  food: number;
  activities: number;
  miscellaneous: number;
}

export class CostBreakdown implements ICostBreakdown {
  constructor(
    public accommodation = 0,
    public transport = 0,
    public food = 0,
    public activities = 0,
    public miscellaneous = 0
  ) {}

  add(other: ICostBreakdown): CostBreakdown {
    return new CostBreakdown(
      this.accommodation + other.accommodation,
      this.transport + other.transport,
      this.food + other.food,
      this.activities + other.activities,
      this.miscellaneous + other.miscellaneous
    );
  }

  static empty(): CostBreakdown {
    return new CostBreakdown();
  }

  get total(): number {
    return (
      this.accommodation +
      this.transport +
      this.food +
      this.activities +
      this.miscellaneous
    );
  }

  clone(): CostBreakdown {
    return new CostBreakdown(
      this.accommodation,
      this.transport,
      this.food,
      this.activities,
      this.miscellaneous
    )
  }
}

export class CostComparison {
  constructor(
    public estimated = CostBreakdown.empty(),
    public actual = CostBreakdown.empty()
  ) {}

  add(other: CostComparison): CostComparison {
    return new CostComparison(
      this.estimated.add(other.estimated),
      this.actual.add(other.actual)
    );
  }

  static empty(): CostComparison {
    return new CostComparison();
  }
}
