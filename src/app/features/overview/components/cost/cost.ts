import {Component, computed, inject, signal} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartOptions, registerables, ChartType } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { ChartModal } from './chart-modal';
import {TripService} from '../../../../services/trip';
import {CurrencyPipe} from '@angular/common';
import {Country} from '../../../../models/country';
import {LucideAngularModule} from 'lucide-angular';
import {Place} from '../../../../models/place';
import {CostComparison} from '../../../../models/cost';

Chart.register(...registerables);

@Component({
  selector: 'app-cost',
  standalone: true,
  imports: [BaseChartDirective, CurrencyPipe, LucideAngularModule],
  templateUrl: './cost.html',
  styleUrl: './cost.css'
})
export class Cost {
  tripService = inject(TripService);
  private dialog = inject(Dialog);
  readonly isCumulative = signal<boolean>(true);
  readonly isBarCumulative = signal<boolean>(false);

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
    const savValues: number[] = [];
    const meta: { name: string, flag: string }[] = [];

    let costOverTime = new CostComparison();
    const visits = plan.itinerary();
    let currentDate = new Date(start);
    const visitedPlaces = new Set<Place>();
    const visitedCountries = new Set<Country>();

    let cur = CostComparison.empty();
    let cur2 = CostComparison.empty();
    visits.forEach((visit) => {
      if (!visitedPlaces.has(visit.place)) {
        visitedPlaces.add(visit.place);
        cur = cur.add(visit.place.oneTimeCost());
        // costOverTime = costOverTime.add(visit.place.oneTimeCost());
      }
      if (!visitedCountries.has(visit.place.country)) {
        visitedCountries.add(visit.place.country);
        cur = cur.add(visit.place.country.oneTimeCost());
        // costOverTime = costOverTime.add(visit.place.country.oneTimeCost());
      }
      cur = cur.add(visit.cost()); // Could separate this over the nights, now all paid on arrival.
      cur2 = isCum ? cur2.add(cur) : cur;
      // costOverTime = costOverTime.add(visit.cost()); // Could separate this over the nights, now all paid on arrival.
      labels.push(new Date(currentDate));
      estValues.push(cur2.estimated.total);
      actValues.push(cur2.actual.total);
      savValues.push(70000 - cur2.actual.total);
      meta.push({name: visit.place.name(), flag: this.countryFlags[visit.place.country.name] || '🏳️'});
      currentDate.setDate(currentDate.getDate() + visit.nights());


      const traverse = visit.nextTraverse();
      if (traverse) {
        cur = traverse.cost_(); // Could separate this over the nights, now all paid on departure.
        // costOverTime = costOverTime.add(traverse.cost_());  // Could separate this over the nights, now all paid on departure.
      }
    });

    return {
      labels,
      datasets: [
        {
          data: estValues,
          label: 'Estimate',
          stepped: isCum ? false : 'middle',
          borderColor: '#3b82f6',
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
      estAcc.push(Math.round(est.accommodation / nights));
      estFood.push(Math.round(est.food / nights));
      estTrans.push(Math.round(est.transport / nights));
      estMisc.push(Math.round(est.miscellaneous / nights));
      actAcc.push(Math.round(act.accommodation / nights));
      actFood.push(Math.round(act.food / nights));
      actTrans.push(Math.round(act.transport / nights));
      actMisc.push(Math.round(act.miscellaneous / nights));
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
        { data: actMisc, label: 'Act. Misc', backgroundColor: '#F39C12', stack: 'act' }
      ]
    };

    // return {
    //   labels,
    //   datasets: [
    //     { data: accData, label: 'Accommodation', backgroundColor: '#5dade2', stack: 'total' },
    //     { data: foodData, label: 'Food', backgroundColor: '#58d68d', stack: 'total' },
    //     { data: transportData, label: 'Transport', backgroundColor: '#af7ac5', stack: 'total' },
    //     { data: miscData, label: 'Misc', backgroundColor: '#f39c12', stack: 'total' }
    //   ]
    // };
  });

  readonly visitedCountries = computed<Country[]>(() => {
    const plan = this.tripService.plan();
    if (!plan) return [];
    return [...new Set(plan.itinerary().map(v => v.place.country).filter(c => c.inItinerary()))].sort((a, b) => a.name.localeCompare(b.name));
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
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
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
            const flag = this.countryFlags[country.name] || '';
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

  openFullscreen(type: 'line' | 'bar') {
    const isLine = type === 'line';
    console.log(isLine);

    this.dialog.open(ChartModal, {
      data: {
        title: isLine ? 'Spending Forecast' : 'Daily Costs by Country',
        chartData: isLine ? this.lineChartData() : this.barChartData(),
        chartType: isLine ? 'line' : 'bar',
        chartOptions: {
          ...(isLine ? this.lineChartOptions : this.barChartOptions),
          maintainAspectRatio: false
        }
      }
    });
  }

  private countryFlags: Record<string, string> = {
    "Australia": "🇦🇺", "Bolivia": "🇧🇴", "Chile": "🇨🇱", "Colombia": "🇨🇴",
    "Costa Rica": "🇨🇷", "Ecuador": "🇪🇨", "Indonesia": "🇮🇩", "Laos": "🇱🇦",
    "Netherlands": "🇳🇱", "Nicaragua": "🇳🇮", "Panama": "🇵🇦", "Peru": "🇵🇪",
    "Philippines": "🇵🇭", "Singapore": "🇸🇬", "Thailand": "🇹🇭", "Vietnam": "🇻🇳",
    "Argentina": "🇦🇷", "Malaysia": "🇲🇾"
  };
}
