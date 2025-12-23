export interface IUserTrip {
  id: string;
  name: string;
  plans: IUserPlan[];
}

export interface IUserPlan {
  id: string;
  name: string;
  priority: number;
}
