import { computed, signal } from '@angular/core';
import { Visit } from './visit';
import {ITraverse, Traverse} from './traverse';
import {Place} from './place';
import {IVisit} from './visit';
import {CostComparison} from './cost';
import {TripService} from '../services/trip';

export interface PlanDataPackage {
  readonly plan: IPlan;
  readonly visits: IVisit[];
  readonly traverses: ITraverse[];
}

export interface IPlan {
  id: string;
  name: string;
  start_date: string;
  note: string;
  priority: number;
  lat: number;
  lng: number;
  zoom: number;
  trip_id: string;
}

export type NewPlan = Omit<IPlan, 'id'>;
export type UpdatePlan = Partial<Omit<IPlan, 'id' | 'trip_id'>>;

export class Plan {
  id!: string;
  trip_id!: string;
  name = signal<string>('');
  start_date = signal<Date | null>(null);
  note = signal<string>('');
  priority = signal<number>(0);
  lng = signal<number>(0);
  lat = signal<number>(0);
  zoom = signal<number>(0);

  readonly visits = signal<Map<string, Visit>>(new Map());
  readonly visitsArray = computed(() => Array.from(this.visits().values()));
  readonly sourceVisit = computed(() => this.visitsArray()?.find(
    v => v.place?.name() === 'Eindhoven' && v.ingoingTraverses().length === 0
  ));

  readonly traverses = signal<Map<string, Traverse>>(new Map());
  readonly traversesArray = computed(() => Array.from(this.traverses().values()));

  readonly startDateString = computed(() => {
    const date = this.start_date();
    return date ? date.toLocaleDateString('nl-NL') : '';
  });

  readonly itinerary = computed(() => {
    const source = this.sourceVisit();
    if (!source) return [];
    const sequence: Visit[] = [];
    const seen = new Set<string>();
    let currentVisit: Visit | null = source;
    while (currentVisit && !seen.has(currentVisit.id)) {
      seen.add(currentVisit.id);
      sequence.push(currentVisit);
      currentVisit = currentVisit.outgoingTraverses().filter(t => t.target?.included() && !seen.has(t.target?.id))[0]?.target ?? null;
    }
    return sequence;
  });

  readonly itineraryTraverses = computed(() => {
    const itinerary = this.itinerary() ?? [];
    return itinerary
      .map(v => v.nextTraverse())
      .filter((t): t is Traverse => !!t);
  });

  readonly cost = computed<CostComparison>(() => {
    let total = CostComparison.empty();
    const trip = this.tripService.trip();
    if (!trip) return total;
    Array.from(trip.countries().values()).forEach(c => {
      // if (c.cost().estimated.total !== 0) console.log('adding from country', c.name, c.cost().estimated.total);
      total = total.add(c.cost());
    });
    Array.from(trip.routes().values()).filter(r => r.isCrossCountry()).forEach(r => {
      // if (r.cost().estimated.total !== 0) console.log('adding from cross country', r.id);
      total = total.add(r.cost());
    });
    return total;
  });

  constructor(
    data: IPlan,
    visits: Visit[],
    traverses: Traverse[],
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.trip_id = data.trip_id.toString();
    this.update(data);
    this.visits.set(new Map(visits.map(v => [v.id, v])));
    this.traverses.set(new Map(traverses.map(t => [t.id, t])));
  }

  update(data: Partial<IPlan>) {
    if ('name' in data) this.name.set(data.name ?? '');
    if ('start_date' in data) this.start_date.set(data.start_date ? new Date(data.start_date) : null);
    if ('note' in data) this.note.set(data.note ?? '');
    if ('priority' in data) this.priority.set(data.priority ?? 0);
    if ('lat' in data) this.lat.set(data.lat ?? 0);
    if ('lng' in data) this.lng.set(data.lng ?? 0);
    if ('zoom' in data) this.zoom.set(data.zoom ?? 0);
  }

  addVisit(visit: Visit) {
    this.visits.update(vs => { const newMap = new Map(vs); newMap.set(visit.id, visit); return newMap; });
  }

  removeVisit(visit: Visit): { traverseIds: string[] } {
    const traverseIds: string[] = [];
    // 1. Remove the Visit itself
    this.visits.update(vs => { const newMap = new Map(vs); newMap.delete(visit.id); return newMap; });
    // 2. Cascade to Traverses
    // Any traverse using this visit as a source or target is now an orphan
    this.traverses.update(ts => {
      const newMap = new Map(ts);
      for (const [id, traverse] of ts) {
        if (traverse.source_visit_id === visit.id || traverse.target_visit_id === visit.id) {
          traverseIds.push(id);
          newMap.delete(id);
        }
      }
      return newMap;
    });

    return { traverseIds };
  }

  addTraverse(traverse: Traverse) {
    this.traverses.update(ts => { const newMap = new Map(ts); newMap.set(traverse.id, traverse); return newMap; });
  }

  removeTraverse(traverse: Traverse) {
    this.traverses.update(ts => { const newMap = new Map(ts); newMap.delete(traverse.id); return newMap; });
  }

  removeVisitsByPlace(place: Place): string[] {
    const visitsToRemove = this.visitsArray().filter(v => v.place_id === place.id);
    visitsToRemove.forEach(visit => this.removeVisit(visit));
    return visitsToRemove.map(v => v.id);
  }

  // get totalPlanCost(): number {
  //   // We sum up the costs of the places referenced in each visit
  //   return this.visitsArray().reduce((sum, visit) => sum + (visit.place?.totalDailyCost ?? 0), 0);
  // }

  toJSON(): IPlan {
    return {
      id: this.id,
      trip_id: this.trip_id,
      name: this.name(),
      start_date: this.start_date()?.toISOString().split('T')[0] ?? null,
      note: this.note(),
      priority: this.priority(),
      lat: this.lat(),
      lng: this.lng(),
      zoom: this.zoom()
    } as IPlan;
  }
}
