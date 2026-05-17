import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Agent } from '../models';

function mapAgent(raw: Record<string, unknown>): Agent {
  return {
    id: raw['id'] as string,
    name: raw['name'] as string,
    description: raw['description'] as string | undefined,
    agentType: raw['agent_type'] as string,
    persona: raw['persona'] as string | undefined,
    isActive: raw['is_active'] as boolean,
  };
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/v1`;

  private _agents = signal<Agent[]>([]);
  readonly agents = this._agents.asReadonly();

  loadAgents(): Observable<Agent[]> {
    return this.http.get<unknown[]>(`${this.base}/agents`).pipe(
      map(data => data.map(a => mapAgent(a as Record<string, unknown>))),
      tap(agents => this._agents.set(agents)),
    );
  }

  getAgentById(id: string): Agent | undefined {
    return this._agents().find(a => a.id === id);
  }
}
