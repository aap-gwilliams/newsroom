import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import { cloneDeep, get, groupBy } from 'lodash';
import ReportsTable from './ReportsTable';
import {gettext} from 'utils';
import {REPORTS, runReport, toggleFilterAndQuery, fetchAggregations, toggleFilter} from "../actions";
import {connect} from "react-redux";
import Toggle from "react-toggle";
import 'react-toggle/style.css';
import MultiSelectDropdown from "../../components/MultiSelectDropdown";

class CompanyProducts extends React.Component {
    constructor(props) {
        super(props);

        this.props.reportParams.company = null;
        this.props.reportParams.section = null;
        this.onShowQueriesChange = this.onShowQueriesChange.bind(this, 'showQueries');

        this.state = {
            filters: ['company', 'section'],
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
            section: {
                field: 'section',
                label: gettext('Sections'),
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
        this.props.fetchAggregations(REPORTS['company-products']);
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
        const section = cloneDeep(this.state.section);

        company.options = props.companies
            .filter((company) => props.aggregations.companies.includes(company._id))
            .map((company) => ({
                label: company.name,
                value: company.name,
            }));
        section.options = props.sections
            .map((section) => ({
                label: section.name,
                value: section.name,
            }));

        this.setState({
            company,
            section,
        });
    }

    onShowQueriesChange(key, event) {
        this.props.toggleFilter([key], event.target.checked);
    }

    getProductDetails(products = []) {
        const { sections, reportParams } = this.props;
        const productsByGroup = groupBy(products, (p) => p.product_type);
        const getProductSectionName = (productType) => {
            let section = sections.find(s => s._id === productType);
            return section ? section.name : productType;
        };

        return (<div className="m-2">
            {Object.keys(productsByGroup).map((productType) => (
                <div className='pl-3' key={productType}>{getProductSectionName(productType)}
                    {productsByGroup[productType].map((p) => (
                        <div key={p._id} className="d-flex align-items-center ml-3">
                            <div>{p.name}</div>
                            <div className='ml-3'><span className="font-italic">{gettext('Is enabled')}: </span>{p.is_enabled.toString()}</div>
                            {reportParams.showQueries && <div className="ml-3"><span className="font-italic">{gettext('Query')}: </span>{p.query}</div>}
                            {p.sd_product_id && <div className="ml-3"><span className="font-italic">{gettext('sd_product_id')}: </span>{p.sd_product_id}</div>}
                        </div>))}
                </div>))}
        </div>);
    }

    render() {
        const {results, print, reportParams} = this.props;
        const {filters} = this.state;
        const headers = [gettext('Company'), gettext('Is Enabled'), gettext('Number of Products')];
        let list = get(results, 'length', 0) > 0 ? results.map((item) =>
            [<tr key={item._id} className="table-secondary">
                <td>{item.name}</td>
                <td>{item.is_enabled.toString()}</td>
                <td>{item.products.length}</td>
            </tr>,
            <tr key={`${item._id}-products`}>
                <td colSpan="3">
                    {this.getProductDetails(item.products)}
                </td>
            </tr>]
        ) : ([(<tr key='no_data_row'>
            <td></td>
            <td>{gettext('No Data')}</td>
            <td></td>
        </tr>)]);

        const filterSection = (<Fragment>
            <div key='report_filters' className="align-items-center d-flex flex-sm-nowrap flex-wrap m-0 px-3 wire-column__main-header-agenda">
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
                <div className={'d-flex align-items-center ml-auto mr-3'}>
                    <label htmlFor='show-queries' className="mr-2">{gettext('Show queries')}</label>
                    <Toggle
                        id="show-queries"
                        defaultChecked={reportParams.showQueries}
                        className='toggle-background'
                        icons={false}
                        onChange={this.onShowQueriesChange}/>
                </div>
            </div>
        </Fragment>);

        return [filterSection,
            (<ReportsTable key='report_table' headers={headers} rows={list} print={print} />)];
    }
}

CompanyProducts.propTypes = {
    results: PropTypes.array,
    print: PropTypes.bool,
    companies: PropTypes.array,
    runReport: PropTypes.func,
    toggleFilter: PropTypes.func,
    toggleFilterAndQuery: PropTypes.func,
    isLoading: PropTypes.bool,
    reportParams: PropTypes.object,
    sections: PropTypes.array,
    fetchAggregations: PropTypes.func,
    aggregations: PropTypes.object,
};

const mapStateToProps = (state) => ({
    companies: state.companies,
    reportParams: state.reportParams,
    isLoading: state.isLoading,
    sections: state.sections,
    aggregations: state.reportAggregations,
});

const mapDispatchToProps = { toggleFilterAndQuery, runReport, fetchAggregations, toggleFilter };

export default connect(mapStateToProps, mapDispatchToProps)(CompanyProducts);
