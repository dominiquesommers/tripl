import {Component, computed, ElementRef, HostListener, inject, signal} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions, registerables, ChartType } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { ChartModal } from './chart-modal';
import {TripService} from '../../../../services/trip';
import {CostService} from '../../../../services/cost';
import {CurrencyPipe} from '@angular/common';
import {Country} from '../../../../models/country';
import {LucideAngularModule} from 'lucide-angular';
import {Place} from '../../../../models/place';
import {CostComparison} from '../../../../models/cost';
import {COUNTRY_FLAGS} from '../../../../components/map-handler/config/countries.config';
import {Cost, AggregateCostBreakdown} from '../../../../components/ui2/cost/cost';

Chart.register(...registerables);

// green under budget, red over — same sign convention as the CostBadge diff arrow
const UNDER_BUDGET_COLOR = 'rgba(16, 185, 129, 1)';
const OVER_BUDGET_COLOR  = 'rgba(239, 68, 68, 1)';
const UNDER_BUDGET_FILL  = 'rgba(16, 185, 129, 0.15)';
const OVER_BUDGET_FILL   = 'rgba(239, 68, 68, 0.15)';

@Component({
  selector: 'app-cost-overview',
  standalone: true,
  imports: [BaseChartDirective, LucideAngularModule, Cost],
  templateUrl: './cost-overview.html',
  styleUrl: './cost-overview.css'
})
export class CostOverview {
  tripService = inject(TripService);
  costService = inject(CostService);

  private dialog = inject(Dialog);
  private elementRef = inject(ElementRef);

  readonly isCumulative = signal<boolean>(true);
  readonly isBarCumulative = signal<boolean>(false);

  readonly countryFlags = COUNTRY_FLAGS;

  // Country filter for the Spending Trend chart
  readonly isCountryPanelOpen = signal(false);
  // null = "all countries" (default, untouched state)
  private readonly selectedCountries = signal<Set<Country> | null>(null);

  // ── Category icon/color mapping for app-cost breakdown tooltips ───────
  // NOTE: guessed to match the palette already used in barChartData below.
  // Swap for your real getCategoryIcon()/getCategoryColor() helpers if you have them.
  private readonly categoryIcons: Record<string, string> = {
    accommodation: 'bed',
    food: 'utensils',
    transport: 'car',
    miscellaneous: 'shopping-bag'
  };

  private readonly categoryColors: Record<string, string> = {
    accommodation: '#85C1E9',
    food: '#82E0AA',
    transport: '#BB8FCE',
    miscellaneous: '#F8C471'
  };

  private breakdownFor(cost: CostComparison): AggregateCostBreakdown[] {
    // Prefer actual category values once real spend exists, else fall back to estimate.
    const source = cost.actual.total > 0 ? cost.actual : cost.estimated;
    return [
      {icon: this.categoryIcons['accommodation'], iconColor: this.categoryColors['accommodation'], label: 'Accommodation', value: source.accommodation},
      {icon: this.categoryIcons['food'], iconColor: this.categoryColors['food'], label: 'Food', value: source.food},
      {icon: this.categoryIcons['transport'], iconColor: this.categoryColors['transport'], label: 'Transport', value: source.transport},
      {icon: this.categoryIcons['miscellaneous'], iconColor: this.categoryColors['miscellaneous'], label: 'Misc', value: source.miscellaneous},
    ];
  }

  readonly totalBreakdown = computed<AggregateCostBreakdown[]>(() => this.breakdownFor(this.total2()));
  readonly toDateBreakdown = computed<AggregateCostBreakdown[]>(() => this.breakdownFor(this.toDate()));

  countryBreakdown(country: Country): AggregateCostBreakdown[] {
    return this.breakdownFor(country.cost());
  }

  readonly isAllCountriesSelected = computed(() => {
    const selected = this.selectedCountries();
    return selected === null || selected.size === this.visitedCountries().length;
  });

  readonly countryFilterLabel = computed(() => {
    const selected = this.selectedCountries();
    const total = this.visitedCountries().length;
    if (selected === null || selected.size === total) return 'All Countries';
    if (selected.size === 0) return 'None selected';
    if (selected.size === 1) return [...selected][0].name;
    return `${selected.size} Countries`;
  });

  isCountrySelected(country: Country): boolean {
    const selected = this.selectedCountries();
    return selected === null || selected.has(country);
  }

  toggleCountry(country: Country): void {
    const total = this.visitedCountries();
    const base = new Set(this.selectedCountries() ?? total);
    if (base.has(country)) {
      base.delete(country);
    } else {
      base.add(country);
    }
    this.selectedCountries.set(base);
  }

  toggleAllCountries(): void {
    if (this.isAllCountriesSelected()) {
      this.selectedCountries.set(new Set()); // deselect all
    } else {
      this.selectedCountries.set(new Set(this.visitedCountries()));
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (this.isCountryPanelOpen() && !clickedInside) {
      this.isCountryPanelOpen.set(false);
    }
  }

  public total2 = computed<CostComparison>(() => {
    const trip = this.tripService.trip();
    const plan = this.tripService.plan();
    if (!trip || !plan) return CostComparison.empty();
    return plan.cost();
  });


  public toDate = computed<CostComparison>(() => {
    const trip = this.tripService.trip();
    const plan = this.tripService.plan();
    if (!trip || !plan) return CostComparison.empty();
    const visits = plan.itinerary();
    const visitedPlaces = new Set<Place>();
    const visitedCountries = new Set<Country>();
    let current = CostComparison.empty();
    let total = CostComparison.empty();
    const today = new Date();
    visits.forEach((visit) => {
      if (visit.exitDate()! <= today) {
        if (!visitedPlaces.has(visit.place)) {
          visitedPlaces.add(visit.place);
          current = current.add(visit.place.oneTimeCost());
        }
        if (!visitedCountries.has(visit.place.country)) {
          visitedCountries.add(visit.place.country);
          current = current.add(visit.place.country.oneTimeCost());
        }
      }
      current = current.add(visit.cost());
      total = total.add(current);
      const traverse = visit.nextTraverse();
      if (traverse && traverse.exitDate()! <= today) {
        current = traverse.cost_();
      } else {
        current = CostComparison.empty();
      }
    });
    return total;
  });

  // ── Line chart: Budget vs. Projection, with a sign-colored variance band ──
  // Replaces the old 3-line (Estimate/Actual/ImprovedEstimate) design.
  // "Actual" was dropped: it's identical to Projection everywhere Projection
  // has a known value, and adds nothing beyond what the band already shows.

  readonly lineChartData = computed<ChartConfiguration['data']>(() => {
    const trip = this.tripService.trip();
    const plan = this.tripService.plan();
    const startDate = plan?.start_date();
    if (!trip || !plan || !startDate) return { datasets: [] };

    const isCum = this.isCumulative();
    const start = new Date(startDate);
    const labels: Date[] = [];
    const budgetValues: number[] = [];
    const projectionValues: number[] = [];
    const meta: { name: string, flag: string }[] = [];

    const visits = plan.itinerary(); // no longer filtered here — dates must stay correct
    let currentDate = new Date(start);
    const visitedPlaces = new Set<Place>();
    const visitedCountries = new Set<Country>();

    let cur = CostComparison.empty();
    let cur2 = CostComparison.empty();
    visits.forEach((visit) => {
      const included = this.isCountrySelected(visit.place.country);

      if (!visitedPlaces.has(visit.place)) {
        visitedPlaces.add(visit.place);
        if (included) cur = cur.add(visit.place.oneTimeCost());
      }
      if (!visitedCountries.has(visit.place.country)) {
        visitedCountries.add(visit.place.country);
        if (included) cur = cur.add(visit.place.country.oneTimeCost());
      }
      if (included) cur = cur.add(visit.cost());
      cur2 = isCum ? cur2.add(cur) : cur;

      currentDate.setUTCDate(currentDate.getUTCDate() + visit.nights()); // always advance, regardless of filter

      if (included) {
        budgetValues.push(cur2.estimated.total);
        projectionValues.push(cur2.improvedEstimate.total);
        meta.push({name: visit.place.name(), flag: COUNTRY_FLAGS[visit.place.country.name] || '🏳️'});
        labels.push(new Date(currentDate));
      }

      const traverse = visit.nextTraverse();
      if (traverse) {
        if (included) cur = traverse.cost_();
        currentDate.setUTCDate(currentDate.getUTCDate() + (traverse.is_overnight() ? 1 : 0)); // always advance
      }
    });

    return {
      labels,
      datasets: [
        // Projection: the headline number — solid line, filled down to Budget (dataset index 1).
        // Segment coloring tints that fill green/red depending on which side of
        // Budget the Projection sits on at that point, flipping exactly at the crossover.
        {
          data: projectionValues,
          label: 'Projection',
          stepped: isCum ? false : 'middle',
          borderColor: '#93b4d4',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: '+1',
          segment: {
            backgroundColor: (ctx: any) => this.bandColorForSegment(ctx),
          },
          meta,
        } as any,
        // Budget: dashed, muted — the reference line, never the headline.
        {
          data: budgetValues,
          label: 'Budget',
          stepped: isCum ? false : 'middle',
          borderColor: 'rgba(255, 255, 255, 0.35)',
          borderDash: [4, 3],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 3,
          fill: false,
          meta,
        } as any,
      ]
    };
  });

  // Colors the Projection→Budget fill band. Sign is taken from the segment's
  // later point so the color change lands exactly at the crossover, not a
  // step behind it.
  private bandColorForSegment(ctx: any): string {
    const chart = ctx.chart;
    const budgetData = chart.data.datasets[1]?.data as number[] | undefined;
    const idx = ctx.p1DataIndex ?? ctx.p0DataIndex;
    if (!budgetData || idx == null) return 'rgba(148, 163, 184, 0.12)';
    const projection = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y;
    const budget = budgetData[idx];
    if (projection == null || budget == null) return 'rgba(148, 163, 184, 0.12)';
    return projection > budget ? OVER_BUDGET_FILL : UNDER_BUDGET_FILL;
  }

  // ── Bar chart: one stacked Projection bar per country, plus a floating
  // Budget→Projection range bar (Chart.js supports [min, max] data points
  // natively — no boxplot plugin needed) colored by over/under sign ────────

  readonly barChartData = computed<ChartConfiguration['data']>(() => {
    const countries = this.visitedCountries();
    const isCum = this.isBarCumulative();

    const labels = countries.map(c => c.name);
    const projAcc: number[] = [], projFood: number[] = [], projTrans: number[] = [], projMisc: number[] = [];
    const varianceRange: [number, number][] = [];
    const varianceOver: boolean[] = [];

    countries.forEach(country => {
      const totalNights = country.places().reduce((placeAcc, place) => {
        const placeNights = place.visits().reduce((visitAcc, visit) => {
          return visitAcc + (visit.nights() * (visit.inItinerary() ? 1 : 0));
        }, 0);
        return placeAcc + placeNights;
      }, 0);
      const nights = isCum ? 1 : (totalNights || 1);

      const proj = country.cost().improvedEstimate;
      const budget = country.cost().estimated;

      projAcc.push(Math.round(proj.accommodation / nights));
      projFood.push(Math.round(proj.food / nights));
      projTrans.push(Math.round(proj.transport / nights));
      projMisc.push(Math.round(proj.miscellaneous / nights));

      const projTotal = Math.round(proj.total / nights);
      const budgetTotal = Math.round(budget.total / nights);
      varianceRange.push([Math.min(projTotal, budgetTotal), Math.max(projTotal, budgetTotal)]);
      varianceOver.push(projTotal > budgetTotal);
    });

    return {
      labels,
      datasets: [
        { data: projAcc,   label: 'Accommodation', backgroundColor: this.categoryColors['accommodation'], stack: 'projection' },
        { data: projFood,  label: 'Food',           backgroundColor: this.categoryColors['food'], stack: 'projection' },
        { data: projTrans, label: 'Transport',      backgroundColor: this.categoryColors['transport'], stack: 'projection' },
        { data: projMisc,  label: 'Misc',           backgroundColor: this.categoryColors['miscellaneous'], stack: 'projection' },
        {
          data: varianceRange as any,
          label: 'vs. Budget',
          stack: 'variance',
          backgroundColor: varianceOver.map(over => over ? OVER_BUDGET_COLOR : UNDER_BUDGET_COLOR),
          borderRadius: 3,
          barPercentage: 0.4,
        } as any,
      ]
    };
  });

  readonly visitedCountries = computed<Country[]>(() => {
    const plan = this.tripService.plan();
    if (!plan) return [];

    const countries: Country[] = [];
    const seen = new Set<Country>();
    for (const visit of plan.itinerary()) {
      const country = visit.place.country;
      if (seen.has(country) || !country.inItinerary()) continue;
      seen.add(country);
      countries.push(country);
    }
    return countries;
  });

  readonly lineChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
          displayFormats: { day: 'MMM d' }
        },
        grid: { display: false },
        ticks: { color: '#8e8e93', maxRotation: 0 }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#8e8e93',
          callback: (value) => '€' + value
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (context) => {
            const index = context[0].dataIndex;
            const meta = (context[0].dataset as any).meta[index];
            const timestamp = context[0].parsed.x;
            if (timestamp === null || timestamp === undefined) return `${meta.flag} ${meta.name}`;
            const date = new Date(timestamp);
            const day = String(date.getUTCDate()).padStart(2, '0');
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const year = date.getUTCFullYear();
            return `${meta.flag} ${meta.name}\n${day}-${month}-${year}`;
          },
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('nl-NL', {
                style: 'currency',
                currency: 'EUR'
              }).format(context.parsed.y);
            }
            return label;
          },
          // adds a single "Over/Under budget: €X" line beneath the two dataset
          // rows — same wording/sign convention as the CostBadge diff
          afterBody: (contexts) => {
            const projection = contexts.find(c => c.dataset.label === 'Projection')?.parsed.y;
            const budget = contexts.find(c => c.dataset.label === 'Budget')?.parsed.y;
            if (projection == null || budget == null) return [];
            const diff = Math.round((projection - budget) * 100) / 100;
            if (diff === 0) return [];
            const label = diff > 0 ? 'Over budget' : 'Under budget';
            const formatted = new Intl.NumberFormat('nl-NL', {
              style: 'currency',
              currency: 'EUR'
            }).format(Math.abs(diff));
            return [`${label}: ${formatted}`];
          }
        }
      }
    }
  };

  readonly barChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          color: '#8e8e93',
          callback: (value, index) => {
            const country = this.visitedCountries()[index];
            const flag = COUNTRY_FLAGS[country.name] || '';
            return `${flag} ${country.name}`;
          }
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#8e8e93',
          callback: (val) => `€${val}`
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { color: '#8e8e93', usePointStyle: true, padding: 20 }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            if (context.dataset.label === 'vs. Budget') {
              const [lo, hi] = context.raw as [number, number];
              return `vs. Budget: €${Math.round(hi - lo)}`;
            }
            return `${context.dataset.label}: €${context.raw}`;
          }
        }
      }
    },
    elements: {
      bar: {
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }
    }
  };

  readonly spendingTrendLabel = computed(() => {
    const selected = this.selectedCountries();
    const all = this.visitedCountries();
    const total = all.length;

    if (selected === null || selected.size === total) {
      return 'Spending trend over full itinerary';
    }
    if (selected.size === 1) {
      return `Spending trend over ${[...selected][0].name}`;
    }
    return `Spending trend over ${selected.size}/${total} countries`;
  });

  openFullscreen(type: 'line' | 'bar') {
    const isLine = type === 'line';
    this.dialog.open(ChartModal, {
      data: {
        title: isLine ? this.spendingTrendLabel() : 'Daily Costs by Country',
        chartData: isLine ? this.lineChartData() : this.barChartData(),
        chartType: isLine ? 'line' : 'bar',
        chartOptions: {
          ...(isLine ? this.lineChartOptions : this.barChartOptions),
          maintainAspectRatio: false
        }
      }
    });
  }
}