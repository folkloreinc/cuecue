import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isArray from 'lodash/isArray';

export const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export const getIdFromParams = (params) =>
    Object.keys(params).reduce((acc, key) => {
        if (key === 'internalId') {
            acc.id = params[key];
        } else if (key === 'id') {
            acc.externalId = params[key];
        } else {
            acc[key] = params[key];
        }
        return acc;
    }, {});

export const getWhereFromParams = (params = {}, operator = 'AND') =>
    Object.keys(params)
        .reduce((items, key) => [...items, `${key} = ?`], [])
        .join(` ${operator} `);

export const getValuesFromParams = (params) => Object.keys(params).map((key) => params[key]) || [];

export const getParams = (params) => {
    const realParams = getIdFromParams(params);
    const where = getWhereFromParams(realParams);
    const values = getValuesFromParams(realParams);
    return { where, values };
};

export const setUpdateData = (data) =>
    Object.keys(data).map((key) =>
        (isObject(data[key]) || isArray(data[key])) && key === 'data'
            ? JSON.stringify(data[key])
            : data[key],
    );

export const getUpdateFields = (data) => ({
    fields: Object.keys(data)
        .reduce((items, key) => [...items, `${key} = ?`], [])
        .join(', '),
    values: setUpdateData(data),
});

export const setInsertData = (data) =>
    isObject(data)
        ? Object.keys(data).reduce((acc, key) => {
              if (key === 'data' && (isObject(data[key]) || isArray(data[key]))) {
                  acc[key] = JSON.stringify(data[key]);
              } else {
                  acc[key] = data[key];
              }
              return acc;
          }, {})
        : null;

export const getInsertFields = (data) => {
    if (!isObject(data)) {
        return null;
    }
    return {
        columns: Object.keys(data)
            .map((col) => `\`${col}\``)
            .join(', '),
        fields: Object.values(data)
            .map(() => '?')
            .join(', '),
        values: Object.values(setInsertData(data)),
    };
};

export const getResult = (result) =>
    isObject(result)
        ? Object.keys(result).reduce((acc, key) => {
              if (key === 'data' && isString(result[key])) {
                  acc[key] = JSON.parse(result[key]);
              } else {
                  acc[key] = result[key];
              }
              return acc;
          }, {})
        : null;

export const getResults = (results) => results.map((res) => getResult(res));
