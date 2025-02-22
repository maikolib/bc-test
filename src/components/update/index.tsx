import { useCallback, useEffect, useState } from 'react'

import Modal from '@/components/update/Modal'
import Progress from '@/components/update/Progress'
import type { ProgressInfo, UpdateCheckResult } from 'electron-updater'
import { ipcRenderer } from 'electron'
import styles from './update.module.scss'

const Update = () => {
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [versionInfo, setVersionInfo] = useState<VersionInfo>()
  const [updateError, setUpdateError] = useState<ErrorType>()
  const [progressInfo, setProgressInfo] = useState<Partial<ProgressInfo>>()
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [modalBtn, setModalBtn] = useState<{
    cancelText?: string
    okText?: string
    onCancel?: () => void
    onOk?: () => void
  }>({
    onCancel: () => setModalOpen(false),
    onOk: () => ipcRenderer.invoke('start-download'),
  })

  const checkUpdate = async () => {
    setChecking(true)
    const result: UpdateCheckResult | null | { message: string; error: Error } = await ipcRenderer.invoke('check-update')
    setProgressInfo({ percent: 0 })
    setChecking(false)
    setModalOpen(true)
    if (result?.error) {
      setUpdateAvailable(false)
      setUpdateError(result?.error)
    }
  }

  const onUpdateCanAvailable = useCallback((_event: Electron.IpcRendererEvent, arg1: VersionInfo) => {
    setVersionInfo(arg1)
    setUpdateError(undefined)
    // Can be update
    if (arg1.update) {
      setModalBtn((state) => ({
        ...state,
        cancelText: 'Cancel',
        okText: 'Update',
        onOk: () => ipcRenderer.invoke('start-download'),
      }))
      setUpdateAvailable(true)
    } else {
      setUpdateAvailable(false)
    }
  }, [])

  const onUpdateError = useCallback((_event: Electron.IpcRendererEvent, arg1: ErrorType) => {
    setUpdateAvailable(false)
    setUpdateError(arg1)
  }, [])

  const onDownloadProgress = useCallback((_event: Electron.IpcRendererEvent, arg1: ProgressInfo) => {
    setProgressInfo(arg1)
  }, [])

  const onUpdateDownloaded = useCallback((_event: Electron.IpcRendererEvent, ..._args: unknown[]) => {
    setProgressInfo({ percent: 100 })
    setModalBtn((state) => ({
      ...state,
      cancelText: 'Later',
      okText: 'Install now',
      onOk: () => ipcRenderer.invoke('quit-and-install'),
    }))
  }, [])

  useEffect(() => {
    // Get version information and whether to update
    ipcRenderer.on('update-can-available', onUpdateCanAvailable)
    ipcRenderer.on('update-error', onUpdateError)
    ipcRenderer.on('download-progress', onDownloadProgress)
    ipcRenderer.on('update-downloaded', onUpdateDownloaded)

    return () => {
      ipcRenderer.off('update-can-available', onUpdateCanAvailable)
      ipcRenderer.off('update-error', onUpdateError)
      ipcRenderer.off('download-progress', onDownloadProgress)
      ipcRenderer.off('update-downloaded', onUpdateDownloaded)
    }
  }, [])

  return (
    <>
      <Modal
        open={modalOpen}
        cancelText={modalBtn?.cancelText}
        okText={modalBtn?.okText}
        onCancel={modalBtn?.onCancel}
        onOk={modalBtn?.onOk}
        footer={updateAvailable ? /* hide footer */ null : undefined}
      >
        <div className={styles.modalslot}>
          {updateError ? (
            <div className="update-error">
              <p>Error downloading the latest version.</p>
              <p>{updateError.message}</p>
            </div>
          ) : updateAvailable ? (
            <div className="can-available">
              <div>The last version is: v{versionInfo?.newVersion}</div>
              <div className="new-version-target">
                v{versionInfo?.version} -&gt; v{versionInfo?.newVersion}
              </div>
              <div className="update-progress">
                <div className="progress-title">Update progress:</div>
                <div className="progress-bar">
                  <Progress percent={progressInfo?.percent}></Progress>
                </div>
              </div>
            </div>
          ) : (
            <div className="can-not-available">{JSON.stringify(versionInfo ?? {}, null, 2)}</div>
          )}
        </div>
      </Modal>
      <button disabled={checking} onClick={checkUpdate}>
        {checking ? 'Checking...' : 'Check update'}
      </button>
    </>
  )
}

export default Update
