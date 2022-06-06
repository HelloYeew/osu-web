// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import { invert } from 'lodash';
import { action, computed, intercept, makeObservable, observable } from 'mobx';
import core from 'osu-core-singleton';
import { updateQueryString } from 'utils/url';

export const charToKey: Record<string, FilterKey> = {
  c: 'general',
  e: 'extra',
  g: 'genre',
  l: 'language',
  m: 'mode',
  nsfw: 'nsfw',
  played: 'played',
  q: 'query',
  r: 'rank',
  s: 'status',
  sort: 'sort',
};

export const keyToChar = invert(charToKey);

export const keyNames = ['extra', 'general', 'genre', 'language', 'mode', 'nsfw', 'played', 'query', 'rank', 'sort', 'status'] as const;

const changesResetSorts: FilterKey[] = ['query', 'status'];
const filtersRequireSupporter: FilterKey[] = ['played', 'rank'];

export function filtersFromUrl(url: string) {
  const params = new URL(url).searchParams;

  const filters: Partial<BeatmapsetSearchFilters> = {};

  for (const [char, key] of Object.entries(charToKey)) {
    const value = params.get(char);

    if (value == null || value.length === 0) continue;

    filters[key] = value;
  }

  return filters;
}

export type BeatmapsetSearchParams = {
  [key in FilterKey]: filterValueType
};

export type FilterKey = (typeof keyNames)[number];
type filterValueType = string | null;


export class BeatmapsetSearchFilters implements BeatmapsetSearchParams {
  @observable extra: filterValueType = null;
  @observable general: filterValueType = null;
  @observable genre: filterValueType = null;
  @observable language: filterValueType = null;
  @observable mode: filterValueType = null;
  @observable nsfw: filterValueType = null;
  @observable played: filterValueType = null;
  @observable query: filterValueType = null;
  @observable rank: filterValueType = null;
  @observable sort: filterValueType = null;
  @observable status: filterValueType = null;

  @computed
  get displaySort() {
    // FIXME: should not return null.
    return this.selectedValue('sort');
  }

  @computed
  get queryParams() {
    const charParams: Record<string, filterValueType> = {};

    for (const key of keyNames) {
      const value = this[key];

      charParams[keyToChar[key]] = value === this.getDefault(key) ? null : value;
    }

    return charParams;
  }

  @computed
  get searchSort() {
    const [field, order] = (this.displaySort ?? '').split('_');
    return { field, order };
  }

  @computed
  get supporterRequired() {
    return keyNames.filter((key) => this[key] != null && filtersRequireSupporter.includes(key));
  }

  constructor(url: string) {
    const filters = filtersFromUrl(url);
    for (const key of keyNames) {
      this[key] = filters[key] ?? null;
    }

    makeObservable(this);

    intercept(this, 'query', (change) => {
      change.newValue = osu.presence((change.newValue as filterValueType)?.trim());

      return change;
    });
  }

  getDefault(key: FilterKey) {
    switch (key) {
      case 'nsfw':
        return String(core.userPreferences.get('beatmapset_show_nsfw'));
      case 'played':
        return 'any';
      case 'status':
        return 'leaderboard';
      case 'sort':
        if (this.query?.trim().length ?? 0 > 0) {
          return 'relevance_desc';
        } else if (['pending', 'wip', 'graveyard', 'mine'].includes(this.status ?? '')) {
          return 'updated_desc';
        } else {
          return 'ranked_desc';
        }
    }

    return null;
  }

  href(key: FilterKey, value: string | null) {
    const actualValue = value === this.getDefault(key) ? null : value;
    return updateQueryString(null, { ...this.queryParams, [keyToChar[key]]: actualValue });
  }

  selectedValue(key: FilterKey) {
    return this[key] ?? this.getDefault(key);
  }

  toKeyString() {
    return keyNames.map((key) => `${key}=${this.selectedValue(key)}`).join('&');
  }

  @action
  update(key: FilterKey, value: filterValueType) {
    const oldValue = this[key];
    if (value === oldValue) return;
    if (changesResetSorts.includes(key)) {
      this.sort = null;
    }

    this[key] = value;
  }
}
