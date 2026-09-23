import { Component, Inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { BaseChartDirective } from 'ng2-charts';




@Component({
  selector: 'app-chart-modal',
  standalone: true,
  imports: [BaseChartDirective],
  template: `
    <div class="modal-container">
      <div class="modal-header">
        <h3>{{ data.title }}</h3>
        <button (click)="dialogRef.close()" class="close-btn">✕</button>
      </div>
      <div class="modal-body">
        <canvas baseChart
                [data]="data.chartData"
                [options]="data.chartOptions"
                [type]="data.chartType">
        </canvas>
      </div>
    </div>
  `,
  styles: [`
    .modal-container {
      background: rgba(30, 30, 35, 0.75);
      backdrop-filter: blur(30px) saturate(180%);
      -webkit-backdrop-filter: blur(30px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 10px 0 30px rgba(0, 0, 0, 0.3);
      border-radius: 20px;
      padding: 16px;
      width: 80vw;
      height: 70vh;
      display: flex;
      flex-direction: column;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      color: white;
    }
    .modal-header button {
      background: none; border: none; color: white; cursor: pointer; font-size: 20px;
    }
    .modal-body { flex: 1; min-height: 0; }
    .close-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
      transition: background 0.2s;
    }

    .close-btn:hover { background: rgba(255, 255, 255, 0.1); }
    /*.close-btn {*/
    /*  background: rgba(255, 255, 255, 0.05);*/
    /*  border: 1px solid rgba(255, 255, 255, 0.1);*/
    /*  border-radius: 50%;*/
    /*  width: 32px;*/
    /*  height: 32px;*/
    /*  line-height: 30px;*/
    /*  transition: all 0.2s;*/
    /*}*/
    /*.close-btn:hover {*/
    /*  background: rgba(211, 47, 47, 0.2);*/
    /*  color: #ff5252;*/
    /*}*/
  `]
})
export class ChartModal {
  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) public data: {
      title: string,
      chartData: any,
      chartOptions: any,
      chartType: 'line' | 'bar'
    }
  ) {}
}
