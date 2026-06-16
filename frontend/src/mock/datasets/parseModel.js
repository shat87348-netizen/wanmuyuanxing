/** Mock: ParseModel 数据 */
export const parseModel = {
  parseModelJson: JSON.stringify({
    protocols: [
      { id: 1, configName: '遥测JSON解析', protocolType: 'JSON', dataType: '遥测', description: '标准遥测数据JSON解析配置', enabled: true, jsonFields: [{ jsonPath: '$.satellite.id', fieldName: 'satelliteId', dataType: 'string' }, { jsonPath: '$.telemetry.temp', fieldName: 'temperature', dataType: 'float' }, { jsonPath: '$.telemetry.volt', fieldName: 'voltage', dataType: 'float' }] },
      { id: 2, configName: 'PDXP帧解析', protocolType: 'PDXP', dataType: '遥测', description: 'PDXP二进制帧解析配置', enabled: true, frameHeaderFields: [{ fieldName: '版本', identifier: 'VER', value: '0x01' }, { fieldName: '任务标志', identifier: 'MID', value: '0x1001' }, { fieldName: '信源地址', identifier: 'SID', value: '0x01' }, { fieldName: '信宿地址', identifier: 'DID', value: '0x02' }, { fieldName: '数据标志', identifier: 'BID', value: '0x0001' }, { fieldName: '数据处理标志', identifier: 'BID', value: '0x0001' }, { fieldName: '保留', identifier: 'RES', value: '0x0000' }], pdxpFields: [{ fieldName: '温度', offset: 0, length: 4, dataType: 'float', byteOrder: 'LittleEndian' }, { fieldName: '电压', offset: 4, length: 4, dataType: 'float', byteOrder: 'LittleEndian' }, { fieldName: '电流', offset: 8, length: 4, dataType: 'float', byteOrder: 'LittleEndian' }] },
      { id: 3, configName: 'Protobuf遥测', protocolType: 'Protobuf', dataType: '遥测', description: 'Protobuf格式遥测解析', enabled: true, protoDefinition: 'message Telemetry { optional string satellite_id = 1; optional float temperature = 2; optional float voltage = 3; }', protoFields: [{ protoField: 'temperature', fieldName: '温度', dataType: 'float', transform: '' }, { protoField: 'voltage', fieldName: '电压', dataType: 'float', transform: '' }] },
    ],
  }),
  alarmRulesJson: JSON.stringify([
    { id: 1, ruleName: '温度过高告警', paramName: 'temperature', condition: '>', threshold: 80, level: 'CRITICAL', enabled: true },
    { id: 2, ruleName: '电压过低告警', paramName: 'voltage', condition: '<', threshold: 22, level: 'WARNING', enabled: true },
    { id: 3, ruleName: '电流异常告警', paramName: 'current', condition: '>', threshold: 15, level: 'WARNING', enabled: true },
    { id: 4, ruleName: '信号丢失告警', paramName: 'signalStrength', condition: '<', threshold: 30, level: 'CRITICAL', enabled: true },
    { id: 5, ruleName: '存储容量告警', paramName: 'storageUsage', condition: '>', threshold: 90, level: 'WARNING', enabled: true },
  ]),
  calConfigJson: JSON.stringify({
    channels: [
      { id: 'CH-001', name: '温度校准通道A', type: '温度', method: '线性插值', coefficients: [1.02, -0.5], enabled: true },
      { id: 'CH-002', name: '电压校准通道B', type: '电压', method: '多项式', coefficients: [1.0, 0.01, -0.001], enabled: true },
      { id: 'CH-003', name: '电流校准通道C', type: '电流', method: '线性插值', coefficients: [0.98, 0.2], enabled: false },
    ],
  }),
}
