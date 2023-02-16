import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {gettext, formatDate} from 'utils';
import {get} from 'lodash';
import ReportsTable from './ReportsTable';
import DropdownFilter from "../../components/DropdownFilter";
import {runReport, toggleFilterAndQuery} from "../actions";
import {connect} from "react-redux";


class ExpiredCompanies extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.props.reportParams.status = null;
        this.getDropdownItems = this.getDropdownItems.bind(this);

        this.filters = [{
            label: gettext('Active'),
            field: 'status'
        }];
    }

    componentWillMount() {
        // Run report on initial loading with default filters
        this.props.runReport();
    }

    getDropdownItems(filter) {
        const { toggleFilterAndQuery } = this.props;
        let getName = (text) => (text);
        let itemsArray = [{
            name: 'True',
            value: 'true'
        },
        {
            name: 'False',
            value: 'false'
        }];
        return itemsArray.map((item, i) => (<button
            key={i}
            className='dropdown-item'
            onClick={() => toggleFilterAndQuery(filter.field, item.value)}
        >{getName(item.name)}</button>));
    }

    getFilterLabel(filter, activeFilter) {
        if (activeFilter[filter.field]) {
            return activeFilter[filter.field];
        } else {
            return filter.label;
        }
    }

    render() {
        const {results, print, reportParams, toggleFilterAndQuery} = this.props;
        const headers = [gettext('Company'), gettext('Is Active'), gettext('Created'), gettext('Expiry Date')];
        const list = results && results.map((item) =>
            <tr key={item._id}>
                <td>{get(item, 'name')}</td>
                <td className={item.is_enabled ? 'font-weight-bold text-danger' : null}>{item.is_enabled ? gettext('Active') : gettext('Disabled')}</td>
                <td>{formatDate(get(item, '_created'))}</td>
                <td>{get(item, 'expiry_date') ? formatDate(item.expiry_date) : gettext('Unspecified')}</td>
            </tr>
        );

        const filterSection = (<Fragment>
            <div key='report_filters' className="align-items-center d-flex flex-sm-nowrap flex-wrap m-0 px-3 wire-column__main-header-agenda">
                {this.filters.map((filter) => (
                    <DropdownFilter
                        key={filter.label}
                        filter={filter}
                        getDropdownItems={this.getDropdownItems}
                        activeFilter={reportParams}
                        getFilterLabel={this.getFilterLabel}
                        toggleFilter={toggleFilterAndQuery}
                    />
                ))}
            </div>
        </Fragment>);

        return [filterSection,
            (<ReportsTable key='report_table' headers={headers} rows={list} print={print} />)];
    }
}

ExpiredCompanies.propTypes = {
    results: PropTypes.array,
    print: PropTypes.bool,
    runReport: PropTypes.func,
    toggleFilterAndQuery: PropTypes.func,
    isLoading: PropTypes.bool,
    reportParams: PropTypes.object,
};

const mapStateToProps = (state) => ({
    reportParams: state.reportParams,
    isLoading: state.isLoading,
});

const mapDispatchToProps = { toggleFilterAndQuery, runReport };

export default connect(mapStateToProps, mapDispatchToProps)(ExpiredCompanies);