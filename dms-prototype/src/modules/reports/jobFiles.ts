/**
 * Saving the files a background job produced (UC042).
 *
 * Its own module rather than a helper inside the jobs tab, because the header's
 * notification panel calls it too — *"a link to download the file"* is on the
 * notification, and a layout component importing from a module page would be
 * the wrong way round.
 */

// `lib/download`, NOT `lib/exporters`: this module is reachable from the header's
// notification bell, and `exporters` imports SheetJS. See lib/download.ts.
import { downloadBlob } from '@/lib/download'
import { recallJobFile, type ReportJob } from '@/stores/reportStore'

/**
 * Save every file in a job; returns how many were still in memory.
 *
 * Staggered rather than fired in one tick: browsers throttle or silently drop
 * several synchronous downloads from a single gesture, and "five Excel files
 * arrived" is precisely the beat this has to land.
 */
export function downloadJobFiles(job: ReportJob): number {
  let saved = 0
  job.files.forEach((file, i) => {
    const blob = recallJobFile(job.id, file.name)
    if (!blob) return
    saved++
    setTimeout(() => downloadBlob(blob, file.name), i * 250)
  })
  return saved
}
