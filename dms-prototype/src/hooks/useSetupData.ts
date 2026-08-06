/**
 * TanStack Query hooks over XMartClient.
 *
 * Every Setup tab reads through these rather than importing seed files, so the
 * module genuinely behaves as if its configuration came from xMart (UC014) —
 * loading states, latency and all. Swapping in a real client changes nothing
 * above this file.
 */

import { useQuery } from '@tanstack/react-query'
import { mockXMartClient } from '@/data/xmart/mockClient'

/** Configuration data changes rarely; cache it for the session. */
const CONFIG_STALE_MS = 5 * 60 * 1000

export function useCountries() {
  return useQuery({
    queryKey: ['xmart', 'countries'],
    queryFn: () => mockXMartClient.getCountries(),
    staleTime: CONFIG_STALE_MS,
  })
}

export function useCurrencies() {
  return useQuery({
    queryKey: ['xmart', 'currencies'],
    queryFn: () => mockXMartClient.getCurrencies(),
    staleTime: CONFIG_STALE_MS,
  })
}

export function useVariables() {
  return useQuery({
    queryKey: ['xmart', 'variables'],
    queryFn: () => mockXMartClient.getVariables(),
    staleTime: CONFIG_STALE_MS,
  })
}

export function useClassifications() {
  return useQuery({
    queryKey: ['xmart', 'classifications'],
    queryFn: () => mockXMartClient.getClassifications(),
    staleTime: CONFIG_STALE_MS,
  })
}

export function useCrosses() {
  return useQuery({
    queryKey: ['xmart', 'crosses'],
    queryFn: () => mockXMartClient.getCrosses(),
    staleTime: CONFIG_STALE_MS,
  })
}

export function useFormulas() {
  return useQuery({
    queryKey: ['xmart', 'formulas'],
    queryFn: () => mockXMartClient.getFormulas(),
    staleTime: CONFIG_STALE_MS,
  })
}

export function useMetadataFields() {
  return useQuery({
    queryKey: ['xmart', 'metadata-fields'],
    queryFn: () => mockXMartClient.getMetadataFields(),
    staleTime: CONFIG_STALE_MS,
  })
}

export function useReportingContacts() {
  return useQuery({
    queryKey: ['xmart', 'reporting-contacts'],
    queryFn: () => mockXMartClient.getReportingContacts(),
    staleTime: CONFIG_STALE_MS,
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['xmart', 'users'],
    queryFn: () => mockXMartClient.getUsers(),
    staleTime: CONFIG_STALE_MS,
  })
}
