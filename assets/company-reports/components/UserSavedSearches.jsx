import React from 'react';
import PropTypes from 'prop-types';
import ReportsTable from './ReportsTable';
import {cloneDeep, sortBy} from 'lodash';
import { gettext } from 'utils';
import {REPORTS, runReport, toggleFilterAndQuery, fetchAggregations} from "../actions";
import {connect} from "react-redux";
import MultiSelectDropdown from "../../components/MultiSelectDropdown";


class UserSavedSearches extends React.Component {
    constructor(props) {
        super(props);
        const {companies} = this.props;

        this.users = sortBy([...this.props.users.map((u) => ({
            ...u,
            'name': u.first_name.concat(' ', u.last_name),
            'company_name': companies.find(c => c._id === u.company).name
        }))], ['company_name']);
        this.props.reportParams.company = null;
        this.props.reportParams.user = null;
        this.onChangeCompany = this.onChangeCompany.bind(this);

        this.state = {
            filters: ['company', 'user'],
            results: [],
            company: {
                field: 'company',
                label: gettext('Companies'),
                options: [],
                onChange: this.onChangeCompany,
                showAllButton: true,
                multi: false,
                default: null,
            },
            user: {
                field: 'user',
                label: gettext('Users'),
                options: [],
                onChange: this.props.toggleFilterAndQuery,
                showAllButton: true,
                multi: false,
                default: null,
            },
        };
    }

    componentWillMount() {
        // Fetch the user & company aggregations to populate those dropdowns
        this.props.fetchAggregations(REPORTS['user-saved-searches']);
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
        const user = cloneDeep(this.state.user);

        if (!props.reportParams.company) {
            company.options = props.companies
                .filter((company) => props.aggregations.companies.includes(company._id))
                .map((company) => ({
                    label: company.name,
                    value: company.name,
                }));
        }
        user.options = this.users
            .filter((user) => props.aggregations.users.includes(user._id))
            .map((user) => ({
                label: props.reportParams.company ? user.name : user.name.concat(' - ', user.company_name),
                value: props.reportParams.company ? user.name : user.name.concat('|', user.company_name),
            }));

        this.setState({
            company,
            user,
        });
    }

    onChangeCompany(field, value) {
        this.props.reportParams.user = null;
        this.props.toggleFilterAndQuery('company', value);
        this.props.fetchAggregations(REPORTS['user-saved-searches']);
    }

    render() {
        const {results, print, reportParams} = this.props;
        const {filters} = this.state;
        const headers = [
            gettext('Company'),
            gettext('User'),
            gettext('Is Enabled'),
            gettext('Number Of Saved Searches'),
        ];
        const list = results && results.map((item) =>
            <tr key={item._id}>
                <td>{item.company}</td>
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

UserSavedSearches.propTypes = {
    results: PropTypes.array,
    print: PropTypes.bool,
    companies: PropTypes.array,
    users: PropTypes.array,
    reportParams: PropTypes.object,
    toggleFilterAndQuery: PropTypes.func,
    runReport: PropTypes.func,
    isLoading: PropTypes.bool,
    fetchAggregations: PropTypes.func,
    aggregations: PropTypes.object,
};

const mapStateToProps = (state) => ({
    companies: state.companies,
    users: state.users,
    reportParams: state.reportParams,
    isLoading: state.isLoading,
    aggregations: state.reportAggregations,
});

const mapDispatchToProps = { toggleFilterAndQuery, runReport, fetchAggregations};

export default connect(mapStateToProps, mapDispatchToProps)(UserSavedSearches);