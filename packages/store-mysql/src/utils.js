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

// With the table's columns, a field without a column of its own is looked up in `extra`.
export const getParams = (params, columns = null) => {
    const realParams = getIdFromParams(params);
    if (columns === null) {
        return {
            where: getWhereFromParams(realParams),
            values: getValuesFromParams(realParams),
        };
    }
    const conditions = [];
    const values = [];
    Object.keys(realParams).forEach((key) => {
        if (columns.has(key)) {
            conditions.push(`\`${key}\` = ?`);
            values.push(realParams[key]);
        } else {
            conditions.push('JSON_UNQUOTE(JSON_EXTRACT(`extra`, ?)) = ?');
            values.push(`$.${JSON.stringify(key)}`, realParams[key]);
        }
    });
    return { where: conditions.join(' AND '), values };
};

// Splits an item between the table's columns and `extra`, for the fields without a column.
export const splitExtra = (data, columns) => {
    const own = {};
    const extra = {};
    Object.keys(data).forEach((key) => {
        if (columns.has(key)) {
            own[key] = data[key];
        } else {
            extra[key] = data[key];
        }
    });
    return { own, extra: Object.keys(extra).length > 0 ? extra : null };
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

export const getResult = (result) => {
    if (!isObject(result)) {
        return null;
    }
    const { extra = null, ...columns } = Object.keys(result).reduce((acc, key) => {
        if ((key === 'data' || key === 'extra') && isString(result[key])) {
            acc[key] = JSON.parse(result[key]);
        } else {
            acc[key] = result[key];
        }
        return acc;
    }, {});
    // The fields in `extra` come back as fields of the item.
    return { ...(isObject(extra) ? extra : null), ...columns };
};

export const getResults = (results) => results.map((res) => getResult(res));
