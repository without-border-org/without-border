import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Agent, Channel } from '../models';

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
  private _channelAgentLinks = signal<Map<string, string>>(new Map());
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

  getAgentByName(name: string | undefined | null): Agent | undefined {
    if (!name) return undefined;
    return this._agents().find(agent => this.matchesAgentName(agent, name));
  }

  getAgentForChannel(channel: Channel | null | undefined, channels: Channel[] = []): Agent | undefined {
    if (!channel || channel.type !== 'pair') return undefined;

    const linkedAgentId = this._channelAgentLinks().get(channel.id);
    if (linkedAgentId) return this.getAgentById(linkedAgentId);

    const directMatch = this.getAgentByName(channel.name);
    if (directMatch) return directMatch;

    const inferredAgentId = this.buildChannelAgentMap(channels).get(channel.id);
    return inferredAgentId ? this.getAgentById(inferredAgentId) : undefined;
  }

  isAgentChannel(channel: Channel | null | undefined, channels: Channel[] = []): boolean {
    if (!channel || channel.type !== 'pair') return false;
    return channel.description === 'Agent IA' || !!this.getAgentForChannel(channel, channels);
  }

  buildAgentChannelMap(channels: Channel[]): Map<string, string> {
    const map = new Map<string, string>();
    const agentsById = new Map(this._agents().map(agent => [agent.id, agent]));
    const candidateChannels = channels.filter(channel =>
      channel.type === 'pair' && (channel.description === 'Agent IA' || !!this.getAgentByName(channel.name))
    );
    const availableChannels = new Map(candidateChannels.map(channel => [channel.id, channel]));

    this._channelAgentLinks().forEach((agentId, channelId) => {
      if (!agentsById.has(agentId) || !availableChannels.has(channelId)) return;
      map.set(agentId, channelId);
      availableChannels.delete(channelId);
    });

    this._agents().forEach(agent => {
      if (map.has(agent.id)) return;

      const matchedChannel = Array.from(availableChannels.values()).find(channel => this.matchesAgentName(agent, channel.name));
      if (!matchedChannel) return;

      map.set(agent.id, matchedChannel.id);
      availableChannels.delete(matchedChannel.id);
    });

    const remainingAgents = this._agents().filter(agent => !map.has(agent.id));
    const remainingChannels = Array.from(availableChannels.values()).filter(channel => channel.description === 'Agent IA');
    if (remainingAgents.length === 1 && remainingChannels.length === 1) {
      map.set(remainingAgents[0].id, remainingChannels[0].id);
    }

    return map;
  }

  findChannelForAgent(agent: Agent, channels: Channel[]): Channel | undefined {
    const channelId = this.buildAgentChannelMap(channels).get(agent.id);
    return channelId ? channels.find(channel => channel.id === channelId) : undefined;
  }

  linkChannelToAgent(channelId: string, agentId: string) {
    this._channelAgentLinks.update(existing => {
      const next = new Map(existing);
      next.set(channelId, agentId);
      return next;
    });
  }

  private buildChannelAgentMap(channels: Channel[]): Map<string, string> {
    const channelAgentMap = new Map<string, string>();
    this.buildAgentChannelMap(channels).forEach((channelId, agentId) => {
      channelAgentMap.set(channelId, agentId);
    });
    return channelAgentMap;
  }

  private matchesAgentName(agent: Agent, candidate: string | undefined | null): boolean {
    if (!candidate) return false;

    const normalizedCandidate = this.normalizeName(candidate);
    return agent.name.trim().toLowerCase() === candidate.trim().toLowerCase()
      || this.normalizeName(agent.name) === normalizedCandidate;
  }

  private normalizeName(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '');
  }
}
