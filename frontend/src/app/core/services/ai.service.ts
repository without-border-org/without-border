import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AiService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/v1/ai`;

  checkHealth() {
    return this.http.get<{ provider: string; model: string; available: boolean; message: string }>(`${this.base}/health`);
  }

  generateSummary(channelId: string) {
    return this.http.post<{ summary: string; generated_at: string }>(`${this.base}/channels/${channelId}/summary`, {});
  }

  generateActionPlan(channelId: string) {
    return this.http.post<{ action_plan: string; generated_at: string }>(`${this.base}/channels/${channelId}/action-plan`, {});
  }

  generateReport(channelId: string) {
    return this.http.post<{ report: string; generated_at: string }>(`${this.base}/channels/${channelId}/report`, {});
  }
}
