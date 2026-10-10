declare class QRCode {
  constructor(typeNumber: number, errorCorrectLevel: number)
  addData(data: string): void
  make(): void
  isDark(row: number, col: number): boolean
  getModuleCount(): number
}
export default QRCode
