import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/motion/dropdown-menu'
import { sortFields, typeOptions } from './guest-helpers'
import type { SortKey } from './guest-helpers'

export type FilterOption = { value: string; label: string }

/** Tapping a checked row removes it; tapping an unchecked row adds it. */
export function toggleFilter(list: string[], setList: (next: string[]) => void, value: string, on: boolean) {
  setList(on ? [...list, value] : list.filter(item => item !== value))
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sort: SortKey
  asc: boolean
  onPickSort: (next: SortKey) => void
  categoryOptions: FilterOption[]
  categories: string[]
  onCategories: (next: string[]) => void
  types: string[]
  onTypes: (next: string[]) => void
  sessionOptions: FilterOption[]
  sessions: string[]
  onSessions: (next: string[]) => void
  activeFilters: number
  onReset: () => void
}

/** Filter button plus its menu: sort order, category, invitation type and session. */
export function GuestFilterMenu({
  open,
  onOpenChange,
  sort,
  asc,
  onPickSort,
  categoryOptions,
  categories,
  onCategories,
  types,
  onTypes,
  sessionOptions,
  sessions,
  onSessions,
  activeFilters,
  onReset,
}: Props) {
  return (
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>
          <button
            type="button"
            className="guests-filter"
            aria-label={`Filter tamu${activeFilters ? `, ${activeFilters} aktif` : ''}`}
          >
            <SlidersHorizontal size={18} aria-hidden />
            {activeFilters > 0 && <span className="guests-filter-count" aria-hidden>{activeFilters}</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="beui-menu guests-filter-menu fm-sheet">
          <div className="fm-scroll">
            <section className="fm-section">
              <p className="fm-header">Urutan</p>
              <div className="fm-group">
                {sortFields.map(option => {
                  const active = sort === option.value
                  return (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      className="fm-row fm-row-sort"
                      checked={active}
                      onCheckedChange={() => onPickSort(option.value)}
                    >
                      <span className="fm-row-text">
                        <span>{option.label}</span>
                        {active && (
                          <span className="fm-row-sub">{asc ? option.asc : option.desc}</span>
                        )}
                      </span>
                    </DropdownMenuCheckboxItem>
                  )
                })}
              </div>
            </section>

            <section className="fm-section">
              <p className="fm-header">Kategori</p>
              <div className="fm-group">
                {categoryOptions.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    className="fm-row"
                    checked={categories.includes(option.value)}
                    onCheckedChange={on => toggleFilter(categories, onCategories, option.value, on)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
            </section>

            <section className="fm-section">
              <p className="fm-header">Jenis undangan</p>
              <div className="fm-group">
                {typeOptions.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    className="fm-row"
                    checked={types.includes(option.value)}
                    onCheckedChange={on => toggleFilter(types, onTypes, option.value, on)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
            </section>

            {sessionOptions.length > 0 && (
              <section className="fm-section">
                <p className="fm-header">Sesi acara</p>
                <div className="fm-group">
                  {sessionOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      className="fm-row"
                      checked={sessions.includes(option.value)}
                      onCheckedChange={on => toggleFilter(sessions, onSessions, option.value, on)}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </section>
            )}
          </div>

          {activeFilters > 0 && (
            <div className="fm-footer">
              <button type="button" className="fm-btn fm-btn-reset" onClick={onReset}>
                <RotateCcw size={15} aria-hidden />
                Reset filter
              </button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
  )
}
