import * as XLSX from 'xlsx';
import { InventoryItem } from '../types';

export const excelService = {
  /**
   * 在庫データをExcelファイルとしてエクスポート
   */
  exportInventory: (data: InventoryItem[]) => {
    const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
      '管理番号': item.managementNumber,
      '商品名': item.name,
      'カテゴリ': item.category,
      'ステータス': item.status,
      'ランク': item.rank || '',
      '入荷日': item.arrivalDate,
      '価格': item.price || 0,
      '保管場所': item.location || '',
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '在庫一覧');

    // ファイル書き出し
    XLSX.writeFile(workbook, `inventory_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  /**
   * Excelファイルから在庫データをインポート
   */
  importInventory: async (file: File): Promise<Partial<InventoryItem>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          resolve(jsonData as Partial<InventoryItem>[]);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }
};
