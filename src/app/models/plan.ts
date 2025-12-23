// src/app/models/plan.ts
import { IVisit, Visit } from './visit';

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

export class Plan implements IPlan {
  id: string;
  name: string;
  start_date: string;
  note: string;
  priority: number;
  lat: number;
  lng: number;
  zoom: number;
  trip_id: string;

  visits: Visit[] = [];

  constructor(data: IPlan) {
    this.id = data.id;
    this.name = data.name;
    this.start_date = data.start_date;
    this.note = data.note ?? '';
    this.priority = data.priority ?? 0;
    this.lat = data.lat;
    this.lng = data.lng;
    this.zoom = data.zoom;
    this.trip_id = data.trip_id;
  }

  get totalPlanCost(): number {
    // We sum up the costs of the places referenced in each visit
    return this.visits.reduce((sum, visit) => sum + (visit.place?.totalDailyCost ?? 0), 0);
  }
}
