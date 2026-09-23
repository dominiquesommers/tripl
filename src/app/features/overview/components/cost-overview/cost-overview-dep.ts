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

  readonly lineChartData = computed<ChartConfiguration['data']>(() => {
    const trip = this.tripService.trip();
    const plan = this.tripService.plan();
    const startDate = plan?.start_date();
    if (!trip || !plan || !startDate) return { datasets: [] };

    const isCum = this.isCumulative();
    const start = new Date(startDate);
    const labels: Date[] = [];
    const estValues: number[] = [];
    const actValues: number[] = [];
    const impEstValues: number[] = [];
    const savValues: number[] = [];
    const meta: { name: string, flag: string }[] = [];

    let costOverTime = new CostComparison();
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
        estValues.push(cur2.estimated.total);
        actValues.push(cur2.actual.total);
        impEstValues.push(cur2.improvedEstimate.total);
        savValues.push(70000 - cur2.actual.total);
        meta.push({name: visit.place.name(), flag: COUNTRY_FLAGS[visit.place.country.name] || '🏳️'});
        labels.push(new Date(currentDate));
      }

      const traverse = visit.nextTraverse();
      if (traverse) {
        if (included) cur = traverse.cost_();
        currentDate.setUTCDate(currentDate.getUTCDate() + (traverse.is_overnight() ? 1 : 0)); // always advance
        // costOverTime = costOverTime.add(traverse.cost_());
      }
    });

    return {
      labels,
      datasets: [
        {
          data: estValues,
          label: 'Estimate',
          stepped: isCum ? false : 'middle',
          borderColor: '#93b4d4', // '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          meta: meta
        },
        {
          data: actValues,
          label: 'Actual',
          stepped: isCum ? false : 'middle',
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          meta: meta
        },
        {
          data: impEstValues,
          label: 'ImprovedEstimate',
          stepped: isCum ? false : 'middle',
          borderColor: '#b91097',
          backgroundColor: 'rgba(84,16,185,0.1)',
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          meta: meta
        },
        // {
        //   data: savValues,
        //   label: 'Savings',
        //   stepped: isCum ? false : 'middle',
        //   borderColor: '#b91097',
        //   backgroundColor: 'rgba(84,16,185,0.1)',
        //   fill: true,
        //   pointRadius: 0,
        //   pointHoverRadius: 4,
        //   borderWidth: 2,
        //   meta: meta
        // }
      ]
    };
  });

  readonly barChartData = computed<ChartConfiguration['data']>(() => {
    const countries = this.visitedCountries();
    const isCum = this.isBarCumulative();

    const labels = countries.map(c => c.name);
    const estAcc: number[] = [], estFood: number[] = [], estTrans: number[] = [], estMisc: number[] = [];
    const actAcc: number[] = [], actFood: number[] = [], actTrans: number[] = [], actMisc: number[] = [];
    const impEstAcc: number[] = [], impEstFood: number[] = [], impEstTrans: number[] = [], impEstMisc: number[] = [];

    countries.forEach(country => {
      const totalNights = country.places().reduce((placeAcc, place) => {
        const placeNights = place.visits().reduce((visitAcc, visit) => {
          return visitAcc + (visit.nights() * (visit.inItinerary() ? 1 : 0));
        }, 0);
        return placeAcc + placeNights;
      }, 0);
      const nights = isCum ? 1 : (totalNights || 1);
      const est = country.cost().estimated;
      const act = country.cost().actual;
      const impEst = country.cost().improvedEstimate;
      estAcc.push(Math.round(est.accommodation / nights));
      estFood.push(Math.round(est.food / nights));
      estTrans.push(Math.round(est.transport / nights));
      estMisc.push(Math.round(est.miscellaneous / nights));
      actAcc.push(Math.round(act.accommodation / nights));
      actFood.push(Math.round(act.food / nights));
      actTrans.push(Math.round(act.transport / nights));
      actMisc.push(Math.round(act.miscellaneous / nights));
      impEstAcc.push(Math.round(impEst.accommodation / nights));
      impEstFood.push(Math.round(impEst.food / nights));
      impEstTrans.push(Math.round(impEst.transport / nights));
      impEstMisc.push(Math.round(impEst.miscellaneous / nights));
    });

    return {
      labels,
      datasets: [
        // ESTIMATED STACK (Lighter/Desaturated colors)
        { data: estAcc, label: 'Est. Acc', backgroundColor: '#85C1E9', stack: 'est' },
        { data: estFood, label: 'Est. Food', backgroundColor: '#82E0AA', stack: 'est' },
        { data: estTrans, label: 'Est. Trans', backgroundColor: '#BB8FCE', stack: 'est' },
        { data: estMisc, label: 'Est. Misc', backgroundColor: '#F8C471', stack: 'est' },

        // ACTUAL STACK (Vibrant/Solid colors)
        { data: actAcc, label: 'Act. Acc', backgroundColor: '#3498DB', stack: 'act' },
        { data: actFood, label: 'Act. Food', backgroundColor: '#2ECC71', stack: 'act' },
        { data: actTrans, label: 'Act. Trans', backgroundColor: '#8E44AD', stack: 'act' },
        { data: actMisc, label: 'Act. Misc', backgroundColor: '#F39C12', stack: 'act' },

        // IMP EST STACK (Vibrant/Solid colors)
        { data: impEstAcc, label: 'Imp. Est. Acc', backgroundColor: '#85C1E9', stack: 'imp' },
        { data: impEstFood, label: 'Imp. Est. Food', backgroundColor: '#82E0AA', stack: 'imp' },
        { data: impEstTrans, label: 'Imp. Est. Trans', backgroundColor: '#BB8FCE', stack: 'imp' },
        { data: impEstMisc, label: 'Imp. Est. Misc', backgroundColor: '#F8C471', stack: 'imp' },
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
        grid: { display: false }, //, drawBorder: false },
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
          }
        }
      }
    }
  };

  readonly barChartOptions: ChartOptions = {
    // interaction: {
    //   mode: 'stack', // Focuses on the specific 'est' or 'act' stack
    // },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true, // Enable stacking
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
        stacked: true, // Enable stacking
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
        labels: { color: '#8e8e93', usePointStyle: true, padding: 20, filter: (item) => !item.text.includes('Est.') }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: €${context.raw}`
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