import {get} from 'lodash';

import {createStore, render} from 'utils';
import {initData, runReport} from '../actions';
import { panels } from '../utils';
import companyReportReducer from '../reducers';

const store = createStore(companyReportReducer, 'PrintReports');
const Panel = panels[window.report];
let state = JSON.parse(localStorage.getItem('state'));
delete state.results;
store.dispatch(initData(state));

render(store, Panel, document.getElementById('print-reports'), {
    results: get(window, 'reportData.results'),
    resultHeaders: get(window, 'reportData.result_headers'),
    print: true,
    runReport,
});
