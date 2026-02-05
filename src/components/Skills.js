import React, { Component } from "react";
import api from "../api";
import Card from "react-bootstrap/Card";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const API_BASE = process.env.REACT_APP_API_BASE_URL;


export default class Skills extends Component {
  state = {
    skills: [],
    loading: true,
    error: null
  };

  componentDidMount() {
    api
      .get(`/skills`, { withCredentials: true })
      .then((res) => {
        this.setState({ skills: res.data, loading: false });
      })
      .catch((err) => {
        this.setState({
          error: "Failed to load skills",
          loading: false
        });
      });
  }

  groupByLevel(skills) {
    return skills.reduce((acc, skill) => {
      const level = skill.level;
      acc[level] = acc[level] || [];
      acc[level].push(skill);
      return acc;
    }, {});
  }

  render() {
    const { skills, loading, error } = this.state;

    if (loading) return <p>Loading skills…</p>;
    if (error) return <p className="text-danger">{error}</p>;

    const groupedSkills = this.groupByLevel(skills);
    const levels = Object.keys(groupedSkills)
      .map(Number)
      .sort((a, b) => a - b);

    return (
      <div className="container mt-4">
        <h1 className="mb-4">Skills</h1>

        <Row>
          {levels.map((level) => (
            <Col key={level} md={6} lg={4} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title>Basic {level}</Card.Title>
                  <Card.Subtitle className="mb-2 text-muted">
                    {groupedSkills[level].length} skills
                  </Card.Subtitle>

                  <Card.Text as="ul" className="ps-3">
                    {groupedSkills[level].map((skill) => (
                      <li key={skill.id}>{skill.name}</li>
                    ))}
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }
}
