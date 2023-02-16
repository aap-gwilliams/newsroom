import React from 'react';
import PropTypes from 'prop-types';
import ReportsTable from './ReportsTable';
import {cloneDeep} from 'lodash';
import {gettext} from 'utils';
import {REPORTS, runReport, toggleFilterAndQuery, fetchAggregations} from "../actions";
import {connect} from "react-redux";
import MultiSelectDropdown from "../../components/MultiSelectDropdown";


class CompanySavedSearches extends React.Component {
    constructor(props) {
        super(props);

        this.props.reportParams.company = null;

        this.state = {
            filters: ['company'],
            results: [],
            company: {
                field: 'company',
                label: gettext('Companies'),
                options: [],
                onChange: this.props.toggleFilterAndQuery,
                showAllButton: true,
                multi: false,
                default: null,
            },
        };
    }

    componentWillMount() {
        // Fetch the genre & company aggregations to populate those dropdowns
        this.props.fetchAggregations(REPORTS['company-saved-searches']);
        // Run report on initial loading with default filters
        this.props.runReport();
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.aggregations !== nextProps.aggregations) {
            this.updateAggregations(nextProps);
        }
    }

    updateAggregations(props) {
        const company = cloneDeep(this.state.company);

        company.options = props.companies
            .filter((company) => props.aggregations.companies.includes(company._id))
            .map((company) => ({
                label: company.name,
                value: company.name,
            }));

        this.setState({
            company,
        });
    }

    render() {
        const {results, print, reportParams} = this.props;
        const {filters} = this.state;
        const headers = [gettext('Company'), gettext('Is Enabled'), gettext('Number Of Saved Searches')];
        const list = results && results.map((item) =>
            <tr key={item._id}>
                <td>{item.name}</td>
                <td>{item.is_enabled.toString()}</td>
                <td>{item.topic_count}</td>
            </tr>
        );

        const filterSection = (<div key='report_filters' className="align-items-center d-flex flex-sm-nowrap flex-wrap m-0 px-3 wire-column__main-header-agenda">
            {filters.map((filterName) => {
                const filter = this.state[filterName];

                return (
                    <MultiSelectDropdown
                        key={filterName}
                        {...filter}
                        values={reportParams[filter.field] || filter.default}
                    />
                );
            })}
        </div>);

        return [filterSection,
            (<ReportsTable key='report_table' headers={headers} rows={list} print={print} />)];
    }
}

CompanySavedSearches.propTypes = {
    results: PropTypes.array,
    print: PropTypes.bool,
    companies: PropTypes.array,
    runReport: PropTypes.func,
    toggleFilterAndQuery: PropTypes.func,
    isLoading: PropTypes.bool,
    reportParams: PropTypes.object,
    fetchAggregations: PropTypes.func,
    aggregations: PropTypes.object,
};

const mapStateToProps = (state) => ({
    companies: state.companies,
    reportParams: state.reportParams,
    isLoading: state.isLoading,
    aggregations: state.reportAggregations,
});

const mapDispatchToProps = { toggleFilterAndQuery, runReport, fetchAggregations };

export default connect(mapStateToProps, mapDispatchToProps)(CompanySavedSearches);